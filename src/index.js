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

const utils = require('./utils')
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
 * @param {boolean} isSubDir - boolean is true if template has subdirectory structure
 */
const copyTemplateFiles = (templateDir, projectDir, isSubDir) => {
  let copyPath;
  let templateFiles; // Current file
  templateFiles = fs.readdirSync(templateDir);
  // Remove directories, and files that are unwanted
  if (!isSubDir) {
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
    templateFiles = templateFiles.filter(function (value) {
      return excludes.indexOf(value) < 0;
    });
  }
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
  return false;
};

/**
 * @desc check the diretory is empty or not.
 * @param {string} dir - directory where the project will be created. Required.
 * @param {string} optionalId - app id. Required (but be "undefined")
 * @param {string} optionalName - app name. Required (but can be "undefined"). 
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
    // Get the file from local diretory.
    copyTemplateFiles(templateDir, dir);
  }).then(() => {
    events.emit('log', 'Installing npm packages in project.');
    
    if (!autoInstall) {
      utils.exec('npm install', dir, false).then(() => {
        const commandsWithDesc = [
          {
            name: 'npm start',
            desc: [
              'Starts the development server for you to preview your weex page on browser',
              'You can also scan the QR code using weex playground to preview weex page on native'
            ]
          },
          {
            name: 'npm run dev',
            desc: [
              'Open the code compilation task in watch mode'
            ]
          },
          {
            name: 'npm run ios',
            desc: [
              '(Mac only, requires Xcode)',
              'Starts the development server and loads your app in an iOS simulator'
            ]
          },
          {
            name: 'npm run android',
            desc: [
              '(Requires Android build tools)',
              'Starts the development server and loads your app on a connected Android device or emulator'
            ]
          },
          {
            name: 'npm run pack:ios',
            desc: [
              '(Mac only, requires Xcode)',
              'Packaging ios project into ipa package'
            ]
          },
          {
            name: 'npm run pack:android',
            desc: [
              '(Requires Android build tools)',
              'Packaging android project into apk package'
            ]
          },
          {
            name: 'npm run pack:web',
            desc: [
              'Packaging html5 project into `web/build` folder'
            ]
          },
          {
            name: 'npm run test',
            desc: [
              'Starts the test runner'
            ]
          }
        ]
  
        events.emit('log', `\n${chalk.green(`Success! Created ${path.basename(dir)} at ${dir}`)}`);
        events.emit('log', '\nInside that directory, you can run several commands:\n');
  
        commandsWithDesc.forEach( c => {
          events.emit('log', `\n  ${chalk.yellow(c.name)}`);
          c.desc.forEach(d => {
            events.emit('log', `    ${d}`);
          })
        })
  
        events.emit('log',`\nTo get started:\n`);
        events.emit('log',chalk.yellow(`  cd ${path.basename(dir)}`));
        events.emit('log',chalk.yellow(`  npm start`));
        events.emit('log',`\nEnjoy your hacking time!`);
      }).fail(e => console.log(e))
    }
  });
};
