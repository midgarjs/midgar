const { describe, it } = require('mocha')
const chai = require('chai')
const chaiHttp = require('chai-http')
const assert = require('assert')
const path = require('path')
const Emittery = require('emittery')

const Logger = require('../libs/logger')
const PM = require('../libs/plugin-manager')
const TestPlugin = require('./fixtures/plugins/test/index')

/**
 * @type {Midgar}
 */
const Midgar = require ('../midgar')

chai.use(chaiHttp);
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
 * Test the config
 */
describe('Config', function() {
  it ('is loaded', async () => {
    const midgar = await initMidgar()
    midgar.config.should.not.equal(null, 'config is null')
    midgar.config.web.host.should.equal('localhost', 'Invalid web.host value')
  })
})

/**
 * Test the logger
 */
describe('Logger', function() {
  it ('is init', async () => {
    const midgar = await initMidgar()
    midgar.logger.should.not.equal(null, 'logger is null')

    midgar.logger.should.to.be.an.instanceof(Logger, 'logger is not an instance of Logger')
  })
})

/**
 * Test the plugin manager
 */
describe('Plugin Manager', function() {
  it ('is init', async () => {
    const midgar = await initMidgar()
    midgar.pm.should.not.equal(null, 'pm is null')

    midgar.pm.should.to.be.an.instanceof(PM, 'pm is not an instance of PluginManager')
    midgar.pm.should.to.be.an.instanceof(Emittery, 'pm is not an instance of Emittery')
  })

  it ('Plugin is loaded', async () => { 
    const midgar = await initMidgar()

    const testPlugin = midgar.pm.getPlugin('test')
    testPlugin.should.to.be.an.instanceof(TestPlugin, 'Plugin is not an instance of TestPlugin')
    testPlugin.isInit.should.equal(true, 'Plugin is not init')  
  })
})

/**
 * Test express
 */
describe('Express', function() {
  it ('responde', async () => {
    const midgar = await initMidgar()
    midgar.app.get('/', function(req, res) {
      res.status(200).json({
        success: true,
      })
    })

    chai.request(midgar.app)
      .get('/')
      .end((err, res) => {
          res.should.have.status(200)
          res.body.should.be.a('object')
      })

  })
})

