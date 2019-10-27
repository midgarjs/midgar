const Plugin = require('../../../../plugin')

/**
 * Test plugin
 */
class Test extends Plugin {
  constructor(...args) {
    super(...args)
    this.isInit = false
  }
  /**
   * Init plugin
   */
  async init() {

    // Add services plugin dir
    this.pm.pluginDirs['test'] = 'foo'
    this.isInit = true
  }
}

module.exports = Test
