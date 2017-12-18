'use strict';

var childProcess = require('child_process');
/**
 * @desc excecute command on `cwd`.
 * @param {string} command 
 * @param {string} cwd 
 * @param {boolean} quiet 
 */
var exec = function exec(command, cwd, quiet) {
  return new Promise(function (resolve, reject) {
    try {
      var child = childProcess.exec(command, { cwd: cwd, encoding: 'utf8' }, function () {
        resolve();
      });
      if (!quiet) {
        // console.log(process.stdout)
        child.stdout.pipe(process.stdout);
      }
    } catch (e) {
      console.error('execute command failed :', command);
      reject(e);
    }
  });
};

/**
 * @desc spawn command on `cwd`.
 * @param {string} command 
 * @param {string} cwd 
 * @param {boolean} quiet 
 */
var spawn = function spawn(command, cwd, quiet) {
  return new Promise(function (resolve, reject) {
    try {
      var child = childProcess.spawn(/^win/.test(process.platform) ? 'npm.cmd' : 'npm', [command], { cwd: cwd }, function () {
        resolve();
      });
      child.stdout.on('data', function (data) {
        console.log('stdout: ' + data);
      });

      child.stderr.on('data', function (data) {
        console.log('stderr: ' + data);
      });

      child.on('close', function (code) {
        console.log('child process exited with code ' + code);
      });
      child.on('error', function (error) {
        console.log(error);
      });
    } catch (e) {
      console.error('execute command failed :', command);
      reject(e);
    }
  });
};
module.exports = {
  exec: exec,
  spawn: spawn
};