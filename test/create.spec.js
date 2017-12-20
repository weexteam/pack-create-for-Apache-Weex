const path = require('path');
const weexpackCommon = require('weexpack-common');
const events = weexpackCommon.events;
const shell = require('shelljs');
const fs = require('fs-extra');
const expect = require('chai').expect;

const create = require('../src/index');
const helpers = require('./helpers');
const appName = 'TestBase';
const tmpDir = helpers.createTemplateDir('create_test');
const project = path.join(tmpDir, appName);


const expectFileExisted = (file) => {
  const should = fs.existsSync(file);
  expect(should, `${file} should be include`).to.be.true;
}

const expectFileUnexisted = (file) => {
  const should = fs.existsSync(file);
  expect(should, `${file} should be exclude`).to.be.not.true;
}

describe('checks for valid-identifier', () => {
  it('should reject reserved words from start of id', (done) => {
    create('projectPath', 'int.bob', 'appName', {}, events).fail((err) => {
      expect(err.message).to.be('App id contains a reserved word, or is not a valid identifier.');
    }).fin(done);
  }, 60000);
  it('should reject reserved words from end of id', (done) => {
    create('projectPath', 'bob.class', 'appName', {}, events).fail((err) => {
      expect(err.message).to.be('App id contains a reserved word, or is not a valid identifier.');
    }).fin(done);
  }, 60000);
})

describe('create end-to-end', function () {
  before(function () {
    shell.rm('-rf', project);
    shell.mkdir('-p', tmpDir);
  });
  after(function () {
    process.chdir(path.join(__dirname, '..')); // Needed to rm the dir on Windows.
    shell.rm('-rf', tmpDir);
  });

  describe('create project with not dependence', () => {
    it('should create a weex project successfully', (done) => {
      create(project, '', appName, {}, events).then(done)
    }, 60000);

    it('should some files existed', () => {
      const shouldBeInclude = [
        'package.json',
        'npm-shrinkwrap.json',
        '.babelrc',
        'android.config.json',
        'ios.config.json',
        'start',
        'start.bat',
        'webpack.config.js',
        'src',
        'web',
        'test',        
        'plugins',
        'platforms',
        'configs',
        '.eslintignore',
        '.eslintrc',
        '.postcssrc.js'
      ];
      shouldBeInclude.forEach(file => {
        expectFileExisted(path.join(project, file));
      })
    })

    it('should some files be excluded', () => {
      const shouldBeExclude = [
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
      shouldBeExclude.forEach(file => {
        expectFileUnexisted(path.join(project, file));
      })
    })
  })
});

