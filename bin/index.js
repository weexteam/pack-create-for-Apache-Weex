'use strict';

/**
    Licensed to the Apache Software Foundation (ASF) under one
    or more contributor license agreements.  See the NOTICE file
    distributed with this work for additional information
    regarding copyright ownership.  The ASF licenses this file
    to you under the Apache License, Version 2.0 (the
    "License"); you may not use this file except in compliance
    with the License.  You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing,
    software distributed under the License is distributed on an
    "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
    KIND, either express or implied.  See the License for the
    specific language governing permissions and limitations
    under the License.
*/
var path = require('path');
var fs = require('fs');
var shell = require('shelljs');
var Q = require('q');
var CordovaError = require('weexpack-common').CordovaError;
var ConfigParser = require('weexpack-common').ConfigParser;
var fetch = require('cordova-fetch');
var url = require('url');
var validateIdentifier = require('valid-identifier');
var CordovaLogger = require('weexpack-common').CordovaLogger.get();
var events = require('weexpack-common').events;
// Global configuration paths
var globalConfigPath = process.env.CORDOVA_HOME;
if (!globalConfigPath) {
  var HOME = process.env[process.platform.slice(0, 3) === 'win' ? 'USERPROFILE' : 'HOME'];
  globalConfigPath = path.join(HOME, '.cordova');
}
/**
 * Sets up to forward events to another instance, or log console.
 * This will make the create internal events visible outside
 * @param  {EventEmitter} externalEventEmitter An EventEmitter instance that will be used for
 *   logging purposes. If no EventEmitter provided, all events will be logged to console
 * @return {EventEmitter} 
 */
var setupEvents = function setupEvents(externalEventEmitter) {
  if (externalEventEmitter) {
    // This will make the platform internal events visible outside
    events.forwardEventsTo(externalEventEmitter);
  }
  // There is no logger if external emitter is not present,
  // so attach a console logger
  else {
      CordovaLogger.subscribe(events);
    }
  return events;
};
/**
 * Usage:
 * @dir - directory where the project will be created. Required.
 * @optionalId - app id. Required (but be "undefined")
 * @optionalName - app name. Required (but can be "undefined"). 
 * @cfg - extra config to be saved in .cordova/config.json Required (but can be "{}").
 * @extEvents - An EventEmitter instance that will be used for logging purposes. Required (but can be "undefined"). 
 **/
// Returns a promise.
module.exports = function (dir, optionalId, optionalName, cfg, extEvents) {
  return Q.fcall(function () {
    events = setupEvents(extEvents);
    if (!dir) {
      throw new CordovaError('Directory not specified. See `weexpack --help`.');
    }
    // read projects .cordova/config.json file for project settings
    var configFile = dotCordovaConfig(dir);
    // if data exists in the configFile, lets combine it with cfg
    // cfg values take priority over config file
    if (configFile) {
      var finalConfig = {};
      for (var key1 in configFile) {
        finalConfig[key1] = configFile[key1];
      }
      for (var key2 in cfg) {
        finalConfig[key2] = cfg[key2];
      }
      cfg = finalConfig;
    }
    if (!cfg) {
      throw new CordovaError('Must provide a project configuration.');
    } else if (typeof cfg === 'string') {
      cfg = JSON.parse(cfg);
    }
    if (optionalId) cfg.id = optionalId;
    if (optionalName) cfg.name = optionalName;
    // Make absolute.
    dir = path.resolve(dir);
    // dir must be either empty except for .cordova config file or not exist at all..
    var sanedircontents = function sanedircontents(d) {
      var contents = fs.readdirSync(d);
      if (contents.length === 0) {
        return true;
      } else if (contents.length === 1) {
        if (contents[0] === '.cordova') {
          return true;
        }
      }
      return false;
    };
    if (fs.existsSync(dir) && !sanedircontents(dir)) {
      throw new CordovaError('Path already exists and is not empty: ' + dir);
    }
    if (cfg.id && !validateIdentifier(cfg.id)) {
      throw new CordovaError('App id contains a reserved word, or is not a valid identifier.');
    }
    // This was changed from "uri" to "url", but checking uri for backwards compatibility.
    cfg.lib = cfg.lib || {};
    cfg.lib.www = cfg.lib.www || {};
    cfg.lib.www.url = cfg.lib.www.url || cfg.lib.www.uri;
    if (!cfg.lib.www.url) {
      cfg.lib.www.url = path.join(__dirname, '../templates');
    }
    // TODO (kamrik): extend lazy_load for retrieval without caching to allow net urls for --src.
    cfg.lib.www.version = cfg.lib.www.version || 'not_versioned';
    cfg.lib.www.id = cfg.lib.www.id || 'dummy_id';
    // Make sure that the source www/ is not a direct ancestor of the
    // target www/, or else we will recursively copy forever. To do this,
    // we make sure that the shortest relative path from source-to-target
    // must start by going up at least one directory or with a drive
    // letter for Windows.
    var relPath = path.relative(cfg.lib.www.url, dir);
    var goesUp = relPath.split(path.sep)[0] === '..';
    if (!(goesUp || relPath[1] === ':')) {
      throw new CordovaError('Project dir "' + dir + '" must not be created at/inside the template used to create the project "' + cfg.lib.www.url + '".');
    }
  }).then(function () {
    // Finally, Ready to start!
    events.emit('log', 'Creating a new weex project.');
    // Strip link and url from cfg to avoid them being persisted to disk via .cordova/config.json.
    // TODO: apparently underscore has no deep clone.  Replace with lodash or something. For now, abuse JSON.
    var cfgToPersistToDisk = JSON.parse(JSON.stringify(cfg));
    delete cfgToPersistToDisk.lib.www;
    if (Object.keys(cfgToPersistToDisk.lib).length === 0) {
      delete cfgToPersistToDisk.lib;
    }
    // Update cached version of config.json
    writeToConfigJson(dir, cfgToPersistToDisk, false);
  }).then(function () {
    var isGit = cfg.lib.www.template && isUrl(cfg.lib.www.url);
    var isNPM = cfg.lib.www.template && (cfg.lib.www.url.indexOf('@') > -1 || !fs.existsSync(path.resolve(cfg.lib.www.url)));
    // If symlink, don't fetch
    if (cfg.lib.www.link) {
      events.emit('verbose', 'Symlinking assets.');
      return Q(cfg.lib.www.url);
    }
    events.emit('verbose', 'Copying assets."');
    // Always use cordova fetch to obtain the npm or git template
    if (isGit || isNPM) {
      // Saved to .Cordova folder (ToDo: Delete installed template after using)
      // ToDo: @carynbear properly label errors from fetch as such
      var tempDest = globalConfigPath;
      events.emit('log', 'Using weexpack-fetch for ' + cfg.lib.www.url);
      return fetch(cfg.lib.www.url, tempDest, {}).fail(function (err) {
        events.emit('error', 'Error from Cordova Fetch: ' + err.message);
        throw err;
      });
      // If assets are not online, resolve as a relative path on local computer
    } else {
      cfg.lib.www.url = path.resolve(cfg.lib.www.url);
      return Q(cfg.lib.www.url);
    }
  }).then(function (inputDirectory) {
    var importFromPath = inputDirectory;
    // handle when input wants to specify sub-directory (specified in index.js as "dirname" export); 
    var isSubDir = false;
    try {
      // Delete cached require incase one exists
      delete require.cache[require.resolve(inputDirectory)];
      var templatePkg = require(inputDirectory);
      if (templatePkg && templatePkg.dirname) {
        importFromPath = templatePkg.dirname;
        isSubDir = true;
      }
    } catch (e) {
      events.emit('verbose', 'index.js does not specify valid sub-directory: ' + inputDirectory);
      isSubDir = false;
    }
    if (!fs.existsSync(importFromPath)) {
      throw new CordovaError('Could not find directory: ' + importFromPath);
    }
    var paths = {};
    // get stock config.xml, used if template does not contain config.xml
    paths.configXml = path.join(__dirname, '../templates', 'config.xml');
    paths.jsonNpmShrinkwrap = path.join(__dirname, '../templates', 'npm-shrinkwrap.json');
    // get stock www; used if template does not contain www
    paths.www = path.join(__dirname, '../templates', 'src');
    // get stock hooks; used if template does not contain hooks
    paths.hooks = path.join(__dirname, '../templates', 'hooks');
    // ToDo: get stock package.json if template does not contain package.json;
    var dirAlreadyExisted = fs.existsSync(dir);
    if (!dirAlreadyExisted) {
      fs.mkdirSync(dir);
    }
    try {
      // Copy files from template to project
      if (cfg.lib.www.template) {
        copyTemplateFiles(importFromPath, dir, isSubDir);
      } else {
        copyTemplateFiles(importFromPath, dir, isSubDir);
      }
      // If --link, link merges, hooks, www, and config.xml (and/or copy to root)
      if (cfg.lib.www.link) linkFromTemplate(importFromPath, dir);
      // If following were not copied/linked from template, copy from stock app hello world
      copyIfNotExists(paths.www, path.join(dir, 'src'));
      copyIfNotExists(paths.hooks, path.join(dir, 'hooks'));
      var configXmlExists = projectConfig(dir); // moves config to root if in www
      if (paths.configXml && !configXmlExists) {
        shell.cp(paths.configXml, path.join(dir, 'config.xml'));
      }
      var npmShrinkwrapExists = existNpmShtinkwrap(dir);
      if (paths.jsonNpmShrinkwrap && !npmShrinkwrapExists) {
        shell.cp(paths.jsonNpmShrinkwrap, path.join(dir, 'npm-shrinkwrap.json'));
      }
    } catch (e) {
      if (!dirAlreadyExisted) {
        shell.rm('-rf', dir);
      }
      if (process.platform.slice(0, 3) === 'win' && e.code === 'EPERM') {
        throw new CordovaError('Symlinks on Windows require Administrator privileges');
      }
      throw e;
    }
    var pkgjsonPath = path.join(dir, 'package.json');
    // Update package.json name and version fields
    if (fs.existsSync(pkgjsonPath)) {
      var pkgjson = require(pkgjsonPath);
      if (cfg.name) {
        pkgjson.name = cfg.name.toLowerCase();
      }
      pkgjson.version = '1.0.0';
      fs.writeFileSync(pkgjsonPath, JSON.stringify(pkgjson, null, 4), 'utf8');
    }
    // Create basic project structure.
    if (!fs.existsSync(path.join(dir, 'platforms'))) shell.mkdir(path.join(dir, 'platforms'));
    if (!fs.existsSync(path.join(dir, 'plugins'))) shell.mkdir(path.join(dir, 'plugins'));
    var configPath = path.join(dir, 'config.xml');
    // only update config.xml if not a symlink
    if (!fs.lstatSync(configPath).isSymbolicLink()) {
      // Write out id and name to config.xml; set version to 1.0.0 (to match package.json default version)
      var conf = new ConfigParser(configPath);
      if (cfg.id) conf.setPackageName(cfg.id);
      if (cfg.name) conf.setName(cfg.name);
      conf.setVersion('1.0.0');
      conf.write();
    }
  });
};
/**
 * Recursively copies folder to destination if folder is not found in destination (including symlinks).
 * @param  {string} src for copying
 * @param  {string} dst for copying
 * @return No return value
 */
var copyIfNotExists = function copyIfNotExists(src, dst) {
  if (!fs.existsSync(dst) && src) {
    shell.mkdir(dst);
    shell.cp('-R', path.join(src, '*'), dst);
  }
};
/**
 * Copies template files, and directories into a Cordova project directory.
 * If the template is a www folder, the www folder is simply copied
 * Otherwise if the template exists in a subdirectory everything is copied
 * Otherwise package.json, RELEASENOTES.md, .git, NOTICE, LICENSE, COPYRIGHT, and .npmignore are not copied over.
 * A template directory, and project directory must be passed.
 * templateDir - Template directory
 * projectDir - Project directory
 * isSubDir - boolean is true if template has subdirectory structure (see code around line 229)
 */
var copyTemplateFiles = function copyTemplateFiles(templateDir, projectDir, isSubDir) {
  var copyPath = void 0;
  // if template is a www dir
  if (path.basename(templateDir) === 'www') {
    copyPath = path.resolve(templateDir);
    shell.cp('-R', copyPath, projectDir);
  } else {
    var templateFiles = void 0; // Current file
    templateFiles = fs.readdirSync(templateDir);
    // Remove directories, and files that are unwanted
    if (!isSubDir) {
      var excludes = ['RELEASENOTES.md', '.git', 'NOTICE', 'LICENSE', 'COPYRIGHT', '.npmignore', 'weex-src'];
      templateFiles = templateFiles.filter(function (value) {
        return excludes.indexOf(value) < 0;
      });
    }
    // create src/index.we not index.vue
    var isForceWeFile = process.argv.indexOf('--we') > 0;
    // Copy each template file after filters
    for (var i = 0; i < templateFiles.length; i++) {
      copyPath = path.resolve(templateDir, templateFiles[i]);
      if (isForceWeFile && templateFiles[i].indexOf('src') >= 0) {
        copyPath = path.resolve(templateDir, 'weex-src/index.we');
        shell.cp('-R', copyPath, path.join(projectDir, 'src'));
      } else if (isForceWeFile && templateFiles[i] === 'web') {
        // shell.cp('-R', copyPath, projectDir);
        shell.cp('-Rf', path.resolve(templateDir, 'weex-src/web'), projectDir);
      } else {
        shell.cp('-R', copyPath, projectDir);
      }
    }
  }
};
/**
 * @param  {String} value
 * @return {Boolean} is the input value a url?
 */
var isUrl = function isUrl(value) {
  var u = value && url.parse(value);
  return !!(u && u.protocol && u.protocol.length > 2); // Account for windows c:/ paths
};
/**
 * Find config file in project directory or www directory
 * If file is in www directory, move it outside
 * @param  {String} project directory to be searched
 * @return {String or False} location of config file; if none exists, returns false
 */
var projectConfig = function projectConfig(projectDir) {
  var rootPath = path.join(projectDir, 'config.xml');
  var wwwPath = path.join(projectDir, 'www', 'config.xml');
  if (fs.existsSync(rootPath)) {
    return rootPath;
  } else if (fs.existsSync(wwwPath)) {
    fs.renameSync(wwwPath, rootPath);
    return wwwPath;
  }
  return false;
};
var existNpmShtinkwrap = function existNpmShtinkwrap(projectDir) {
  var rootPath = path.join(projectDir, 'npm-shrinkwrap.json');
  if (fs.existsSync(rootPath)) {
    return rootPath;
  }
  return false;
};
/**
 * Retrieve and read the .cordova/config file of a cordova project
 * 
 * @param  {String} project directory
 * @return {JSON data} config file's contents 
 */
var dotCordovaConfig = function dotCordovaConfig(projectRoot) {
  var configPath = path.join(projectRoot, '.cordova', 'config.json');
  var data = void 0;
  if (!fs.existsSync(configPath)) {
    data = '{}';
  } else {
    data = fs.readFileSync(configPath, 'utf-8');
  }
  return JSON.parse(data);
};
/**
 * Write opts to .cordova/config.json
 * 
 * @param  {String} project directory
 * @param  {Object} opts containing the additions to config.json
 * @param  {Boolean} autopersist option
 * @return {JSON Data}
 */
var writeToConfigJson = function writeToConfigJson(projectRoot, opts, autoPersist) {
  var json = dotCordovaConfig(projectRoot);
  for (var p in opts) {
    json[p] = opts[p];
  }
  if (autoPersist) {
    var configPath = path.join(projectRoot, '.cordova', 'config.json');
    var contents = JSON.stringify(json, null, 4);
    // Don't write the file for an empty config.
    if (contents !== '{}' || fs.existsSync(configPath)) {
      shell.mkdir('-p', path.join(projectRoot, '.cordova'));
      fs.writeFileSync(configPath, contents, 'utf-8');
    }
    return json;
  } else {
    return json;
  }
};
/**
 * Removes existing files and symlinks them if they exist.
 * Symlinks folders: www, merges, hooks 
 * Symlinks file: config.xml (but only if it exists outside of the www folder)
 * If config.xml exists inside of template/www, COPY (not link) it to project/
 * */
var linkFromTemplate = function linkFromTemplate(templateDir, projectDir) {
  var linkSrc = void 0,
      linkDst = void 0,
      linkFolders = void 0,
      copySrc = void 0;
  // if template/www/config.xml then copy to project/config.xml
  var copyDst = path.join(projectDir, 'config.xml');
  var rmlinkSync = function rmlinkSync(src, dst, type) {
    if (src && dst) {
      if (fs.existsSync(dst)) {
        shell.rm('-rf', dst);
      }
      if (fs.existsSync(src)) {
        fs.symlinkSync(src, dst, type);
      }
    }
  };
  // if template is a www dir
  if (path.basename(templateDir) === 'www') {
    linkSrc = path.resolve(templateDir);
    linkDst = path.join(projectDir, 'www');
    rmlinkSync(linkSrc, linkDst, 'dir');
    copySrc = path.join(templateDir, 'config.xml');
  } else {
    linkFolders = ['www', 'merges', 'hooks'];
    // Link each folder
    for (var i = 0; i < linkFolders.length; i++) {
      linkSrc = path.join(templateDir, linkFolders[i]);
      linkDst = path.join(projectDir, linkFolders[i]);
      rmlinkSync(linkSrc, linkDst, 'dir');
    }
    linkSrc = path.join(templateDir, 'config.xml');
    linkDst = path.join(projectDir, 'config.xml');
    rmlinkSync(linkSrc, linkDst, 'file');
    copySrc = path.join(templateDir, 'www', 'config.xml');
  }
  if (!fs.existsSync(copyDst) && fs.existsSync(copySrc)) {
    shell.cp(copySrc, projectDir);
  }
};