import mocha from 'mocha'
import chai from 'chai'
import chaiHttp from 'chai-http'
import dirtyChai from 'dirty-chai'
import chaiFs from 'chai-fs'
import path from 'path'
import _rimraf from 'rimraf'
import _mkdirp from 'mkdirp'
import fs from 'fs'
import os from 'os'
import uid from 'uid-safe'

import Cli from '../src/libs/cli'
import { asyncReadFile } from '@midgar/utils'
import { PLUGINS_CONFIG_FILE } from '../src/libs/plugin-manager'

const PLUGIN_NAME = '@test/test-plugin-2'

// fix for TypeError: describe is not a function with mocha-teamcity-reporter
const { describe, it } = mocha

function rimraf (rmPath) {
  return new Promise((resolve, reject) => {
    _rimraf(rmPath, resolve)
  })
}

const ctx = {}
const name = 'cli-test'
/**
 * before test callback
 */
const br = async () => {
  ctx.dir = path.join(tmpDir, name)
}

/**
 * after test callback
 */
async function ar () {
  // this.timeout(30000)
  await rimraf(tmpDir)
}

const expect = chai.expect
chai.use(chaiFs)
chai.use(chaiHttp)
chai.use(dirtyChai)

function getTmpDir () {
  const dirname = path.join(os.tmpdir(), uid.sync(8))
  fs.mkdirSync(dirname, { mode: parseInt('0700', 8) })
  return dirname
}

const configPath = path.resolve(__dirname, 'fixtures/config')
const tmpDir = getTmpDir()

/**
 * Cli tests
 */
describe('Cli', function () {
  before(br)
  after(ar)

  // Test init command
  it('init', async function () {
    const cli = new Cli(['', '', 'init', ctx.dir])
    await cli.init()
    await cli.run()

    const files = [
      'package.json',
      'yarn.lock',
      '.midrc',
      'src/index.js',
      'src/server.js',
      'src/config/config.js',
      'src/config/plugins.js',
      'src/config/config.prod.js',
      'src/config/config.dev.js'
    ]

    files.forEach(file => {
      expect(path.join(ctx.dir, file)).be.a.file()
    })
  })

  it('add', async function () {
    const file = path.join(configPath, PLUGINS_CONFIG_FILE)
    // Check start config
    let plugins = JSON.parse(await asyncReadFile(file, 'utf8'))
    if (plugins[PLUGIN_NAME]) throw new Error('Invalid plugins.json')

    // Run cli add command
    const cli = new Cli(['', '', 'add', PLUGIN_NAME, '--config', configPath])
    await cli.init()
    const result = await cli.run()

    // Test result
    plugins = JSON.parse(await asyncReadFile(path.join(configPath, PLUGINS_CONFIG_FILE), 'utf8'))
    expect(plugins).be.a('object')
    expect(plugins[PLUGIN_NAME]).to.not.be.undefined()
    expect(plugins[PLUGIN_NAME]).to.be.true()
  })

  it('disable', async function () {
    // Check start config
    let plugins = JSON.parse(await asyncReadFile(path.join(configPath, PLUGINS_CONFIG_FILE), 'utf8'))
    if (plugins[PLUGIN_NAME] === undefined || plugins[PLUGIN_NAME] !== true) throw new Error('Invalid plugins.json')

    // Run cli disable command
    const cli = new Cli(['', '', 'disable', PLUGIN_NAME, '--config', configPath])
    await cli.init()
    await cli.run()

    // Test result
    plugins = JSON.parse(await asyncReadFile(path.join(configPath, PLUGINS_CONFIG_FILE), 'utf8'))
    expect(plugins).be.a('object')
    expect(plugins[PLUGIN_NAME]).to.not.be.undefined()
    expect(plugins[PLUGIN_NAME]).to.be.false()
  })

  it('enable', async function () {
    // Check start config
    let plugins = JSON.parse(await asyncReadFile(path.join(configPath, PLUGINS_CONFIG_FILE), 'utf8'))
    if (plugins[PLUGIN_NAME] === undefined || plugins[PLUGIN_NAME] === true) throw new Error('Invalid plugins.json')

    // Run cli enable command
    const cli = new Cli(['', '', 'enable', PLUGIN_NAME, '--config', configPath])
    await cli.init()
    await cli.run()

    // Test result
    plugins = JSON.parse(await asyncReadFile(path.join(configPath, PLUGINS_CONFIG_FILE), 'utf8'))
    expect(plugins).be.a('object')
    expect(plugins[PLUGIN_NAME]).to.not.be.undefined()
    expect(plugins[PLUGIN_NAME]).to.be.true()
  })

  it('rm', async function () {
    // Check start config
    let plugins = JSON.parse(await asyncReadFile(path.join(configPath, PLUGINS_CONFIG_FILE), 'utf8'))
    if (plugins[PLUGIN_NAME] === undefined) throw new Error('Invalid plugins.json')

    // Run cli rm command
    const cli = new Cli(['', '', 'rm', PLUGIN_NAME, '--config', configPath])
    await cli.init()
    await cli.run()

    // Test result
    plugins = JSON.parse(await asyncReadFile(path.join(configPath, PLUGINS_CONFIG_FILE), 'utf8'))
    expect(plugins).be.a('object')
    expect(plugins[PLUGIN_NAME]).to.be.undefined()
  })
})

/**
 * Test if the command test of the plugin test is call
 */
describe('Test plugin command', function () {
  before(br)
  after(ar)
  it('test', async function () {
    const cli = new Cli(['', '', 'test', '--config', configPath])
    await cli.init()
    const result = await cli.run()
    expect(result.stdout).to.have.string('cli test')
  })
})
