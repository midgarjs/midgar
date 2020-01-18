import Test2Plugin from '../test-plugin-2'

/**
 * Test plugin
 */
class TestRwPlugin extends Test2Plugin {
  /**
   * Init plugin
   */
  async init () {
    await super.init()
    this.bar = 'testrw'
  }
}

export default TestRwPlugin
