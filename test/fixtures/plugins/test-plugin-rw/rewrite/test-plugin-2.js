import Test2Plugin from '../../test-plugin-2'

/**
 * Test plugin
 */
class RwTest2Plugin extends Test2Plugin {
  /**
   * Init plugin
   */
  async init () {
    await super.init()
    this.bar = 'testrw'
  }
}

export default RwTest2Plugin

export const config = {}
