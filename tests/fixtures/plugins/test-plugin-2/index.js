import Plugin from '../../../../src/plugin'

/**
 * Test plugin
 */
class Test2Plugin extends Plugin {
  /**
   * Init plugin
   */
  async init () {
    this.foo = 'test'
    this.pm.addPluginDir('fooxxx', 'fooxxx')
  }
}

export default Test2Plugin
