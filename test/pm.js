import mocha from 'mocha'
import chai from 'chai'
import dirtyChai from 'dirty-chai'
import chaiArrays from 'chai-arrays'
import chaiAsPromised from 'chai-as-promised'
import path from 'path'

import PM from '../src/libs/plugin-manager'
import TestPlugin from './fixtures/plugins/test-plugin/index'
import TestRwPlugin from './fixtures/plugins/test-plugin-rw/index'

/**
 * @type {Midgar}
 */
import Midgar from '../src/midgar'

// fix for TypeError: describe is not a function with mocha-teamcity-reporter
const { describe, it } = mocha

const FOO_PLUGIN_PATH = 'fixtures/plugins/test-plugin/foo'
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
 * Test the plugin manager
 */
describe('Plugin Manager', function () {
  beforeEach(async () => {
    mid = await initMidgar()
  })

  afterEach(async () => {
    await mid.stop()
    mid = null
  })

  /**
   * Test is mid.pm is set and is the plugin manager
   */
  it('init', async () => {
    expect(mid.pm).not.equal(null, 'pm is null')
    expect(mid.pm).to.be.an.instanceof(PM, 'pm is not an instance of PluginManager')
  })

  /**
   * Test if the plugin is load and init
   */
  it('Plugin load', async () => {
    const testPlugin = mid.pm.getPlugin('test-plugin')
    expect(testPlugin).to.be.an.instanceof(TestPlugin, 'Plugin is not an instance of TestPlugin !')
    expect(testPlugin.isInit).to.be.true('Plugin is not init !')
    expect(testPlugin.config.testConfig).equal('ok', 'Plugin config in not load !')
  })

  /**
   * Test if the plugin config is set in midgar config
   */
  it('Plugin config', async () => {
    expect(mid.config.test).to.equal('base', 'Plugin config in not load !')
    expect(mid.config.test2).to.equal('notbase', 'Plugin config in not load !')
  })

  /**
   * Test result importFiles with shouldResult
   *
   * @param {Array} result       Result array from readFiles call
   * @param {Array} shouldResult Result we should have
   */
  function testImportFilesResult (result, shouldResult, dirPath) {
    expect(result).be.array()
    expect(result.length).equal(shouldResult.length)

    // List files in result
    for (let i = 0; i < result.length; i++) {
      const resultFile = result[i]
      let file = null
      // List files we should have
      for (let si = 0; si < shouldResult.length; si++) {
        // Check if it the same file
        if (shouldResult[si].relativePath === resultFile.relativePath) {
          file = shouldResult[si]
          // Check file export
          expect(resultFile.export).equal(file.export)

          // Check plugin name
          expect(resultFile.plugin).equal('test-plugin')

          // check file path
          const filePath = path.join(__dirname, dirPath, file.relativePath)
          expect(resultFile.path).equal(filePath)
          break
        }
      }

      // Check file is found
      expect(file).not.to.be.null()
    }
  }

  /**
   * Test the plugin manager importModules method
   */
  it('importModules', async () => {
    let result = await mid.pm.importModules('test')
    let shouldResult = [
      {
        relativePath: 'file-1.js',
        export: 'test-plugin:foo:file-1'
      },
      {
        relativePath: 'file-2.js',
        export: 'test-plugin:foo:file-2'
      },
      {
        relativePath: 'file-3.js',
        export: 'test-plugin:foo:file-3'
      },
      {
        relativePath: 'sub/sub-file-1.js',
        export: 'test-plugin:foo:sub-file-1'
      }
    ]

    testImportFilesResult(result, shouldResult, FOO_PLUGIN_PATH)

    shouldResult.push()

    testImportFilesResult(result, shouldResult, FOO_PLUGIN_PATH)

    // Config dir
    result = await mid.pm.importModules('boo')
    shouldResult = [
      {
        relativePath: 'file-boo.js',
        export: 'test-plugin:boo:file-boo'
      }
    ]

    testImportFilesResult(result, shouldResult, 'fixtures/plugins/test-plugin/boo')
  })

  /**
   * Test the readFile method
   */
  it('readFile', async () => {
    await expect(mid.pm.readFile('test-plugin:./files/test.txt')).be.rejectedWith(Error, 'Invalid file path !')
    await expect(mid.pm.readFile('test-plugin:/files/test.txt')).be.rejectedWith(Error, 'Invalid file path !')

    let result = await mid.pm.readFile('test-plugin:files/test.txt')
    expect(result).to.equal('test txt', 'Invalid readFile result !')

    result = await mid.pm.readFile('@test/test-plugin-3:files/test.txt')
    expect(result).to.equal('@test/test-plugin-3 test txt', 'Invalid readFile result !')

    result = await mid.pm.readFile('@test/test-plugin-3:files/test-rw.txt')
    expect(result).to.equal('test rewrite', 'Invalid readFile result !')
  })

  /**
   * Test the readFiles method
   */
  it('readFiles', async () => {
    const shouldResult = [
      {
        plugin: 'test-plugin',
        content: 'test txt',
        path: 'files/test.txt'
      },
      {
        plugin: '@test/test-plugin-3',
        content: 'test rewrite',
        path: 'files/test-rw.txt'
      },
      {
        plugin: '@test/test-plugin-3',
        content: '@test/test-plugin-3 test txt',
        path: 'files/test.txt'
      }
    ]
    
    const files = await mid.pm.readFiles('files/*')
    expect(files).to.be.eql(shouldResult, 'Invalid read files result !')
  })

  /**
   * Test the getSortedPlugins method
   */
  it('getSortedPlugins', async () => {
    const result = await mid.pm.getSortedPlugins()
    const shouldSorted = ['@test/test-plugin-3', 'test-outside-plugin', 'test-plugin', 'test-plugin-2', 'test-plugin-rw']
    expect(result).to.eql(shouldSorted, 'Invalid getSortedPlugins result !')
  })

  /**
   * Test if a plugin is rewrited
   */
  it('rewrite plugin', async () => {
    const testPlugin2 = await mid.pm.getPlugin('test-plugin-2')
    expect(testPlugin2).to.be.an.instanceof(TestRwPlugin, 'Plugin is not an instance of TestPlugin !')
    expect(testPlugin2.foo).equal('test', 'Invalid rewrite plugin foo value !')
    expect(testPlugin2.bar).equal('testrw', 'Invalid rewrite plugin foo value !')
  })

  /**
   * Test if a module is rewrited
   */
  it('rewrite modules', async () => {
    const fooxxxFiles = await mid.pm.importModules('fooxxx')
    let find = false
    for (const file of fooxxxFiles) {
      if (file.plugin === 'test-plugin-2' && file.relativePath === 'file-1.js') {
        expect(file.export).equal('test-plugi-rw:fooxxx:file-rw', 'Invalid rewrite module export !')
        find = true
      }
    }

    expect(find).to.be.true()
  })
})
