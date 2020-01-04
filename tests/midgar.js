import mocha from 'mocha'
import chai from 'chai'
import dirtyChai from 'dirty-chai'
import chaiHttp from 'chai-http'
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
chai.use(chaiHttp)
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
    await mid.stop()
    mid = null
    process.exit.restore()
  })

  it('config load', async () => {
    mid = new Midgar()
    expect(mid.initPluginManager()).to.be.rejectedWith(Error, '@midgar/midgar: Load config before !')

    mid = await initMidgar()
    expect(mid.config).not.equal(null, 'config is null')
    expect(mid.config.web.host).equal('localhost', 'Invalid web.host value')
  })

  it('logger', async () => {
    mid = await initMidgar()
    expect(mid.logger).not.equal(null, 'logger is null')
    expect(mid.logger).to.be.an.instanceof(Logger, 'logger is not an instance of Logger')
  })

  /**
   * Test custom logger
   */
  it('custom logger', async () => {
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

/**
 * Test express
 */
describe('Express', function () {
  afterEach(async () => {
    await mid.stop()
    mid = null
  })

  /**
   * Add a route and test a request
   */
  it('HTTPS Serveur', async () => {
    mid = await initMidgar('ssl')
    // Add a get route to test express
    mid.app.get('/getTest', function (req, res) {
      res.status(200).json({
        success: true
      })
    })

    // Do get request to test valid request
    let chaiRes = await chai.request(mid.app).get('/getTest')

    // Test response
    expect(chaiRes).have.status(200)
    expect(chaiRes.body).be.a('object')
    expect(chaiRes.body.success).to.be.true()

    // Do get request to test error request
    chaiRes = await chai.request(mid.app).get('/errorTest')
    // Test response
    expect(chaiRes).have.status(404)
  })
})
