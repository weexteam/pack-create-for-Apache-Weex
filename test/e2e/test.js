const { expect } = require('chai')
const fs = require('fs')
const path = require('path')
const inquirer = require('inquirer')
const generate = require('../../lib/generate')
const metadata = require('../../lib/options')

const MOCK_META_JSON_PATH = path.resolve('./test/e2e/mock-meta-json')
const MOCK_TEMPLATE_BUILD_PATH = path.resolve('./test/e2e/mock-template-build')

function monkeyPatchInquirer (answers) {
  // monkey patch inquirer
  inquirer.prompt = questions => {
    const key = questions[0].name
    const _answers = {}
    const validate = questions[0].validate
    const valid = validate(answers[key])
    if (valid !== true) {
      return Promise.reject(new Error(valid))
    }
    _answers[key] = answers[key]
    return Promise.resolve(_answers)
  }
}


describe('end-to-end', () => {
  const escapedAnswers = {
    name: 'test',
    author: 'erha19 <faterrole@gmail.com>'
  }
  it('adds additional data to meta data', done => {
    monkeyPatchInquirer(escapedAnswers)
    const data = generate('test', MOCK_META_JSON_PATH, MOCK_TEMPLATE_BUILD_PATH, done)
    expect(data.destDirName).to.equal('test')
    expect(data.inPlace).to.equal(false)
  })
})