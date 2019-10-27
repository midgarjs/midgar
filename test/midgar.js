const { describe, it } = require('mocha')
const chai = require('chai')
const chaiHttp = require('chai-http')
const chaiArrays = require('chai-arrays')
const path = require('path')
const Logger = require('../libs/logger')

/**
 * @type {Midgar}
 */
const Midgar = require ('../midgar')

chai.use(chaiHttp)
chai.use(chaiArrays)
chai.should()

let midgar = null

const initMidgar = async () => {
  if (midgar == null) {
    midgar = new Midgar
    await midgar.start(path.join(__dirname, 'fixtures/config'))
  }

  return midgar
}

/**
 * before test callback
 */
const br = async () => {
  await initMidgar()
}

/**
 * after test callback
 */
const ar = async () => {
  if (midgar)
    await midgar.stop()

  midgar = null
}

/**
 * Test the config
 */
describe('Config', function() {
  before(br)
  after(ar)

  it ('is loaded', async () => {
    midgar.config.should.not.equal(null, 'config is null')
    midgar.config.web.host.should.equal('localhost', 'Invalid web.host value')
  })
})

/**
 * Test the logger
 */
describe('Logger', function() {
  before(br)
  after(ar)

  it ('is init', async () => {
    midgar.logger.should.not.equal(null, 'logger is null')

    midgar.logger.should.to.be.an.instanceof(Logger, 'logger is not an instance of Logger')
  })
})

/**
 * Test express
 */
describe('Express', function() {
  before(br)
  after(ar)

  /**
   * Add a route and test a request
   */
  it ('responde', async () => {
    midgar.app.get('/', function(req, res) {
      res.status(200).json({
        success: true,
      })
    })

    // Do request
    const res = await chai.request(midgar.app).get('/')

    // Test response
    res.should.have.status(200)
    res.body.should.be.a('object')
    res.body.success.should.to.be.true
  })
})

