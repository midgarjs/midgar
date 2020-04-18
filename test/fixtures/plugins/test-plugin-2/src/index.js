import Plugin from '../../../../../src/plugin'

/**
 * Test plugin
 */
class Test2Plugin extends Plugin {
  /**
   * Init plugin
   */
  async init () {
    this.foo = 'test'
    this.pm.addModuleType('fooxxx', 'fooxxx')
  }
}

export default Test2Plugin
export const dependencies = ['test-plugin']
