import mocha from 'mocha'
import chai from 'chai'
import dirtyChai from 'dirty-chai'
import chaiArrays from 'chai-arrays'
import chaiAsPromised from 'chai-as-promised'
import path from 'path'
import sinon from 'sinon'

import Logger from '../src/libs/logger'
import CustomLogger from './fixtures/config-cl/custom-logger'

/**
 * @type {Midgar}
 */
import Midgar from '../src/midgar'

// fix for TypeError: describe is not a function with mocha-teamcity-reporter
const { describe, it } = mocha

const expect = chai.expect
chai.use(chaiArrays)
chai.use(dirtyChai)
chai.use(chaiAsPromised)

let mid = null
const initMidgar = async (ext = null) => {
  mid = new Midgar()
  await mid.start(path.join(__dirname, 'fixtures/config' + (ext ? '-' + ext : '')))
  return mid
}

/**
 * Test the config
 */
describe('Midgar', function () {
  beforeEach(async () => {
    sinon.stub(process, 'exit')
  })

  afterEach(async () => {
    if (mid.httpServer !== null) await mid.stop()
    mid = null
    process.exit.restore()
  })

  it('Invalid call order', async () => {
    mid = new Midgar()
    await expect(mid.initLogger()).be.rejectedWith(Error, '@midgar/midgar: Load config before init logger !')
    await expect(mid.initPluginManager()).be.rejectedWith(Error, '@midgar/midgar: Load config before init pm !')
    mid.loadConfig(path.join(__dirname, 'fixtures/config'))
    await expect(mid.initPluginManager()).be.rejectedWith(Error, '@midgar/midgar: Load config before init pm !')

  })

  it('Invalid config path', async () => {
    // Test invalid config directory
    mid = new Midgar()
    
    await expect(mid.start(path.join(__dirname, 'fixtures/test'))).be.rejectedWith(Error, `@midgar/midgar: the file ${path.join(__dirname, 'fixtures/test', 'config.js')} doesn't exist !`)

  })

  it('Config', async () => {
    mid = await initMidgar()
    expect(mid.config).not.equal(null, 'config is null')
    expect(mid.config.pluginsLocalPath).not.be.undefined('Invalid config')
    expect(mid.config.log).not.be.undefined('Invalid config')
  })

  it('Logger', async () => {
    mid = new Midgar()
    await expect(mid.initLogger()).to.be.rejectedWith(Error, '@midgar/midgar: Load config before init logger !')

    mid = await initMidgar()
    expect(mid.logger).not.equal(null, 'logger is null')
    expect(mid.logger).to.be.an.instanceof(Logger, 'logger is not an instance of Logger')
  })

  /**
   * Test custom logger
   */
  it('Custom logger', async () => {
    mid = await initMidgar('cl')
    expect(mid.logger).not.equal(null, 'logger is null')
    expect(mid.logger).to.be.an.instanceof(CustomLogger, 'logger is not an instance of CustomLogger')

    const types = [
      'error',
      'warn',
      'info',
      'verbose',
      'debug',
      'silly'
    ]

    for (const type of types) {
      await mid[type]('test ' + type)
    }

    for (const type of types) {
      expect(mid.logger.messages[type].indexOf('test ' + type)).not.equal(-1, 'Invalid message !')
    }
  })

  /**
   * Test exit methode
   */
  it('exit', async () => {
    mid = await initMidgar()
    await mid.exit()
    sinon.assert.calledWith(process.exit, 0)
  })
})
