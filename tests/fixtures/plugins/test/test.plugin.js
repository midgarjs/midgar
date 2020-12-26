const Plugin = require('../../../../src/plugin')


/**
 * TestPlugin class
 * @class
 */
class TestPlugin extends Plugin {
}

module.exports = {
  plugin: TestPlugin,
  name: 'test',
  dependencies: ['test-npm']
}