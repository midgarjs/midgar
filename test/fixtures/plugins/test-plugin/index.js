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
    this.pm.addModuleType('test', 'foo')
    this.pm.addModuleType('boo', './basefolder')
    this.isInit = true
  }
}

export default Test
export const dependencies = ['@test/test-plugin-3']
export const config = {
  moduleTypes: {
    boo: {
      path: 'boo'
    }
  },
  testConfig: 'ok',
  midgar: {
    test: 'base',
    test2: 'base'
  }
}
