import Plugin from '../../../../src/plugin'

/**
 * Test plugin
 */
class Test extends Plugin {
  constructor (...args) {
    super(...args)
    this.isInit = false
  }

  /**
   * Init plugin
   */
  async init () {
    // Add test plugin dir
    this.pm.addPluginDir('test', 'foo')
    this.pm.addPluginDir('boo', 'basefolder')
    this.isInit = true
  }
}

export default Test
