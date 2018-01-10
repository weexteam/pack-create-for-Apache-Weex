const childProcess = require('child_process');
/**
 * @desc excecute command on `cwd`.
 * @param {string} command 
 * @param {string} cwd 
 * @param {boolean} quiet 
 */
const exec = (command, cwd, quiet) => {
  return new Promise((resolve, reject) => {
    try {
      const child = childProcess.exec(command, { cwd: cwd, encoding: 'utf8' }, () => {
        resolve();
      });
      if (!quiet) {
        child.stdout.pipe(process.stdout);
      }
      // child.stdout.pipe(process.stderr);
    }
    catch (e) {
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
const spawn = (command, cwd, quiet) => {
  return new Promise((resolve, reject) => {
    try {
      const child = childProcess.spawn(/^win/.test(process.platform) ? 'npm.cmd' : 'npm', [command], { cwd: cwd }, () => {
        resolve();
      });
      child.stdout.on('data', (data) => {
        console.log(`stdout: ${data}`);
      });

      child.stderr.on('data', (data) => {
        console.log(`stderr: ${data}`);
      });

      child.on('close', (code) => {
        console.log(`child process exited with code ${code}`);
      });
      child.on('error', (error) => {
        console.log(error);
      });
    }
    catch (e) {
      console.error('execute command failed :', command);
      reject(e);
    }
  });
};
module.exports = {
  exec,
  spawn
};
