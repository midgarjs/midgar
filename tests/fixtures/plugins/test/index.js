const Plugin = require('@midgar/midgar/plugin')

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
    this.isInit = true
  }
}

module.exports = Test
