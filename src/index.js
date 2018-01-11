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
const path = require('path');
const fs = require('fs-extra');
const Q = require('q');
const shell = require('shelljs');
const chalk = require('chalk');

const validateIdentifier = require('valid-identifier');
const WeexpackCommon = require('weexpack-common');
const WeexpackError = WeexpackCommon.CordovaError;
const WeexpackLogger = WeexpackCommon.CordovaLogger.get();
let events = WeexpackCommon.events;

const utils = require('./utils/index');
const getGitUser = require('./utils/git-user');
/**
 * @desc Sets up to forward events to another instance, or log console.
 * This will make the create internal events visible outside
 * @param  {EventEmitter} externalEventEmitter An EventEmitter instance that will be used for
 * logging purposes. If no EventEmitter provided, all events will be logged to console
 * @return {EventEmitter} 
 */
const setupEvents = (externalEventEmitter) => {
  if (externalEventEmitter) {
    // This will make the platform internal events visible outside
    events.forwardEventsTo(externalEventEmitter);
  }
  // There is no logger if external emitter is not present,
  // so attach a console logger
  else {
    WeexpackLogger.subscribe(events);
  }
  return events;
};

/**
 * @desc Copies template files, and directories into a weex project directory.
 * @param {string} templateDir - Template directory
 * @param {string} projectDir - Project directory
 */
const copyTemplateFiles = (templateDir, projectDir, config) => {
  let copyPath;
  let templateFiles; // Current file
  templateFiles = fs.readdirSync(templateDir);
  // Remove directories, and files that are unwanted
  const excludes = [
    'dist',
    'npm-debug.log',
    '.git',
    '.DS_Store',
    '.temp',
    'node_modules',
    'hooks',
    'plugins/plugin.js',
    'platform/android',
    'platform/ios',
    'web/build'
  ];
  if (config.disableUnitTest) {
    excludes.push('test');
  }
  templateFiles = templateFiles.filter(function (value) {
    return excludes.indexOf(value) < 0;
  });
  // Copy each template file after filters
  for (let i = 0; i < templateFiles.length; i++) {
    copyPath = path.resolve(templateDir, templateFiles[i]);
    shell.cp('-R', copyPath, projectDir);
  }
};
/**
 * @desc check the diretory is empty or not.
 * @param {string} dir
 */
const isEmptyDir = (dir) => {
  const contents = fs.readdirSync(dir);
  if (contents.length === 0) {
    return true;
  }
  else if (contents.length === 1 && contents[0] === '.wx') {
    return true;
  }
  return false;
};

/**
 * @desc generate a config.json on project root.
 * @param {string} diretory 
 * @param {Object} config 
 */
const generateWxConfigFile = (diretory, config) => {
  const configRoot = path.join(diretory, '.wx');
  const configFilePath = path.join(configRoot, 'config.json');
  const dirAlreadyExisted = fs.existsSync(configRoot);
  if (!dirAlreadyExisted) {
    fs.mkdirSync(configRoot);
  }
  if (!fs.existsSync(configFilePath)) {
    fs.open(configFilePath, 'w+', '0666', (err, fd) => {
      if (err) {
        throw new WeexpackError('Create `.wx/config.json` fail.');
      }
      fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2));
    });
  }
  else {
    fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2));
  }
};

/**
 * @desc Rewrite package content by config.
 * @param {String} dir 
 * @param {Object} config 
 */
const rewritePackagejson = (dir, config) => {
  const packageJsonPath = path.join(dir, 'package.json');
  if (!fs.existsSync(packageJsonPath) || !config || config.length < 1) {
    return;
  }
  const packageConfigs = require(packageJsonPath);
  packageConfigs.name = config.name || packageConfigs.name;
  packageConfigs.description = config.description || packageConfigs.description;
  packageConfigs.version = config.version || packageConfigs.version;
  packageConfigs.author = config.author || getGitUser();
  if (!config.unit) {
    delete packageConfigs.scripts.unit;
    packageConfigs.scripts.test = 'echo "Error: no test specified" && exit 1';
  }
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageConfigs, null, 2));
};

/**
 * @desc check the diretory is empty or not.
 * @param {string} dir - directory where the project will be created. Required.
 * @param {string} optionalId - app id. Required (but can be "undefined")
 * @param {string} optionalName - app name. Required. 
 * @param {object|string} cfg - extra config to be saved in .cordova/config.json Required (but can be "{}").
 * @param {object} extEvents - An EventEmitter instance that will be used for logging purposes. Required (but can be "undefined"). 
 * @param {boolean} autoInstall - auto install npm packages in project or not.
 */
module.exports = (dir, optionalId, optionalName, cfg, extEvents, autoInstall) => {
  return Q.fcall(() => {
    events = setupEvents(extEvents);
    if (!dir) {
      throw new WeexpackError('Directory not specified. See `weexpack --help`.');
    }
    if (!cfg) {
      throw new WeexpackError('Must provide a project configuration.');
    }
    else if (typeof cfg === 'string') {
      cfg = JSON.parse(cfg);
    }
    if (optionalId) {
      cfg.id = optionalId;
    }
    if (optionalName) {
      cfg.name = optionalName;
    }
    if (!cfg.name) {
      cfg.name = path.basename(dir);
    }
    // Make absolute.
    dir = path.resolve(dir);
    if (fs.existsSync(dir) && !isEmptyDir(dir)) {
      throw new WeexpackError('Path already exists and is not empty: ' + dir);
    }
    if (cfg.id && !validateIdentifier(cfg.id)) {
      throw new WeexpackError('App id contains a reserved word, or is not a valid identifier.');
    }
  }).then(() => {
    // Ready to start!
    // Todo: maybe you can write some weex config here.
  }).then(() => {
    const templateDir = path.join(__dirname, '../templates');
    const dirAlreadyExisted = fs.existsSync(dir);
    // If diretory is not existed, create it.
    if (!dirAlreadyExisted) {
      fs.mkdirSync(dir);
    }
    generateWxConfigFile(dir, cfg);
    // Get the file from local diretory.
    copyTemplateFiles(templateDir, dir, cfg);
    // Rewrite package.json.
    rewritePackagejson(dir, cfg);
  }).then(() => {
    if (!autoInstall) {
      events.emit('log', `\n${chalk.green(`Success! Created ${path.basename(dir)} at ${dir}`)}`);
    }
    if (autoInstall === 'yarn') {
      events.emit('log', 'Installing dependencies using yarn...');
      utils.exec('yarn install', dir, false).then(() => {
        utils.helper(events, dir);
      }).catch(e => {
        events.emit('error', e);
      });
    }
    else {
      events.emit('log', 'Installing dependencies using npm...');
      utils.exec('npm install', dir, false).then(() => {
        utils.helper(events, dir);
      }).catch(e => {
        events.emit('error', e);
      });
    }
  });
};
