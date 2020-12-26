const Plugin = require('../../../../src/plugin')


/**
 * TestNpmPlugin class
 * @class
 */
class TestNpmPlugin extends Plugin {
  constructor (app) {
    super(app)
  }
}

module.exports = {
  plugin: TestNpmPlugin,
  name: 'test-npm',
}