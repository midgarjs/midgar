const { describe, it } = require('mocha')
const chai = require('chai')
const chaiArrays = require('chai-arrays')
const path = require('path')
const Emittery = require('emittery')

const PM = require('../libs/plugin-manager')
const TestPlugin = require('./fixtures/plugins/test/index')

/**
 * @type {Midgar}
 */
const Midgar = require ('../midgar')

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
 * Test the plugin manager
 */
describe('Plugin Manager', function() {
  before(br)
  after(ar)

  /**
   * Test is midgar.pm is set and is the plugin manager
   */
  it ('init', async () => {
    const midgar = await initMidgar()
    midgar.pm.should.not.equal(null, 'pm is null')

    midgar.pm.should.to.be.an.instanceof(PM, 'pm is not an instance of PluginManager')
    midgar.pm.should.to.be.an.instanceof(Emittery, 'pm is not an instance of Emittery')
  })

  /**
   * Test if the test lplugin is load and init
   */
  it ('Plugin load', async () => {
    const midgar = await initMidgar()

    const testPlugin = midgar.pm.getPlugin('test')
    testPlugin.should.to.be.an.instanceof(TestPlugin, 'Plugin is not an instance of TestPlugin')
    testPlugin.isInit.should.equal(true, 'Plugin is not init')  
  })

  /**
   * Test result readFiles with shouldResult
   * 
   * @param {Array} result       Result array from readFiles call
   * @param {Array} shouldResult Result we should have
   */
  function testReadFilesResult(result, shouldResult) {
    result.should.be.array()
    result.length.should.equal(shouldResult.length)

    // List files in result
    for (let i = 0;i < result.length; i++) {
      const resultFile = result[i]
      let file = null;
      // List files we should have
      for (let si = 0;si < shouldResult.length; si++) {
        // Check if it the same file
        if(shouldResult[si].relativePath == resultFile.relativePath) {
          file = shouldResult[si]
         
          // Check file export
          resultFile.export.should.equal(file.export)

          // Check plugin name
          resultFile.plugin.should.equal('test')

          // check file path
          const filePath = path.join(__dirname, 'fixtures/plugins/test/foo', file.relativePath)
          resultFile.path.should.equal(filePath)
          break
        }
      }

      // Check file is found
      file.should.not.to.be.null
    }
  }

  /**
   * Test the readFiles method
   */
  it ('readFiles', async () => {
    const midgar = await initMidgar()

    // Non recursive test
    let result = await midgar.pm.readFiles('test', null, false)
    const shouldResult = [
      {
        relativePath: 'file-1.js',
        export: 'test 1'
      },
      {
        relativePath: 'file-2.js',
        export: 'test 2'
      },
      {
        relativePath: 'file-3.js',
        export: 'test 3'
      }
    ]

    testReadFilesResult(result, shouldResult)
  
    // Recursive test
    result = await midgar.pm.readFiles('test')
    shouldResult.push(      {
      relativePath: 'sub/sub-file-1.js',
      export: 'sub test 1'
    })


    testReadFilesResult(result, shouldResult)

  })

  /**
   * Test result getDirs with shouldResult
   * 
   * @param {Array} result       Result array from getDirs call
   * @param {Array} shouldResult Result we should have
   */
  function testGetDirsResult(result, shouldResult) {
    result.should.be.array()
    result.length.should.equal(shouldResult.length)

    // List files in result
    for (let i = 0;i < result.length; i++) {
      const resultDir = result[i]
      let dir = null;
      // List files we should have
      for (let si = 0;si < shouldResult.length; si++) {
        dir = shouldResult[si]
        // Check if it the same dir
        if(dir.path == resultDir.path) {
          // Check plugin name
          resultDir.plugin.should.equal(dir.plugin)
          break
        }
      }

      // Check file is found
      dir.should.not.to.be.null
    }
  }
  

  /**
   * Test the getDirs method
   */
  it ('getDirs', async () => {
    const midgar = await initMidgar()

    let result = await midgar.pm.getDirs('test')
    const shouldResult = [
      {
        path: path.join(__dirname, 'fixtures/plugins/test/foo'),
        plugin: 'test'
      }
    ]

    testGetDirsResult(result, shouldResult)
  })
})

