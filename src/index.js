const ora = require('ora');
const download = require('download-git-repo');
const exists = require('fs').existsSync;
const rm = require('rimraf').sync;
const home = require('user-home');
const path = require('path');
const generate = require('./generate');
const { logger, localpath } = require('./utils');
const isLocalPath = localpath.isLocalPath;
const getTemplatePath = localpath.getTemplatePath;

/**
 * Check the diretory is empty or not.
 *
 * @param {string} dir - directory where the project will be created. Required.
 * @param {string} dirname - name of the directory. Required
 * @param {string} template - tempalte name. Required.
 * @param {boolean} isRandomPath - whether dir is a random path that user assigned
 */
module.exports = (dir, dirname, template, extEvents, options, isRandomPath) => {
  if (typeof extEvents === 'boolean') {
    isRandomPath = extEvents;
    extEvents = null;
    options = null;
  } else if (typeof options === 'boolean') {
    isRandomPath = options;
    options = null;
  }

  return new Promise((resolve, reject) => {
    if (extEvents && typeof extEvents !== 'boolean') {
      logger.setupEvents(extEvents);
    }
    if (isLocalPath(template)) {
      const templatePath = getTemplatePath(template);
      if (exists(templatePath)) {
        generate(dirname, templatePath, dir, err => {
          if (err) logger.error(err);
          logger.success(`Generated ${dirname}`);
        }, isRandomPath);
      }
      else {
        logger.error(`Local template "${template}" not found.`);
      }
    }
    // download template from git.
    else {
      const tmp = path.join(home, '.weex-templates', template.replace(/\//g, '-'));
      const spinner = ora(`Downloading template from ${template} repo`);
      spinner.start();
      // Remove if local template exists
      if (exists(tmp)) rm(tmp);
      download(template, tmp, options, err => {
        spinner.stop();
        if (err) logger.error('Failed to download repo ' + template + ': ' + err.message.trim());
        generate(dirname, tmp, dir, err => {
          if (err) logger.error(err);
          logger.success(`Generated ${dirname}`);
        }, isRandomPath);
      });
    }
  });
};
