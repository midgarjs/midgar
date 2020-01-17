import { describe, it } from 'mocha'
import chai from 'chai'
import dirtyChai from 'dirty-chai'
import chaiFs from 'chai-fs'
import chaiAsPromised from 'chai-as-promised'
import path from 'path'
import _rimraf from 'rimraf'
import fs from 'fs'
import os from 'os'
import uid from 'uid-safe'

import Cli from '../src/libs/cli'
import { asyncReadFile, asyncWriteFile } from '@midgar/utils'
import { PLUGINS_CONFIG_FILE } from '../src/libs/plugin-manager'

const PLUGIN_NAME = '@test/test-plugin-2'

// Add chai middlware
const expect = chai.expect
chai.use(chaiFs)
chai.use(dirtyChai)
chai.use(chaiAsPromised)

/**
 * Promised rimraf
 * @param {Sting} rmPath Path
 * @private
 */
function rimraf (rmPath) {
  return new Promise((resolve, reject) => {
    _rimraf(rmPath, resolve)
  })
}

/**
 * Create random dir in tmp os directory and return it
 * @private
 */
function getTmpDir () {
  const dirname = path.join(os.tmpdir(), uid.sync(8))
  // fs.mkdirSync(dirname, { mode: parseInt('0700', 8) })
  return dirname
}

let tmpDir = null
const configPath = path.resolve(__dirname, 'fixtures/config')
const pluginsConfigPath = path.resolve(__dirname, 'fixtures/config-plugins')

/**
 * Cli tests
 */
describe('Cli', function () {
  before(async () => {
    // Create tmp dir
    tmpDir = getTmpDir()
    await asyncWriteFile(path.join(pluginsConfigPath, PLUGINS_CONFIG_FILE), '{}')
  })

  after(async () => {
    // clean tmp dir
    await rimraf(tmpDir)
    await asyncWriteFile(path.join(pluginsConfigPath, PLUGINS_CONFIG_FILE), '{}')
  })

  /**
   * Test cli get config path from rc file
   */
  it('rc file', async function () {
    const argv = ['', '', 'test']
    const cwd = path.resolve(__dirname, 'fixtures/test/test/test')
    const cli = new Cli(argv, cwd)
    await cli.init()
    expect(cli.mid.configPath).equal(configPath, 'Invalid config path')
  })

  /**
   * Test invalid command
   */
  it('Invalid command', async function () {
    const argv = ['', '', 'invalidcmd']
    const cwd = path.resolve(__dirname, 'fixtures/test/test/test')
    const cli = new Cli(argv, cwd)
    await cli.init()
    await expect(cli.run()).be.rejectedWith('Invalid command: invalidcmd\nSee --help for a list of available commands.', 'nlalala')
  })
  /**
   * Test init command
   */
  it('init', async function () {
    // Call init cli command on tmp dir
    const cli = new Cli(['', '', 'init', tmpDir], tmpDir)
    await cli.init()
    await cli.run()

    // Check if all template files are created
    const files = [
      'package.json',
      '.gitignore',
      '.eslintrc.js',
      'yarn.lock',
      '.midgarrc.js',
      'src/index.js',
      'src/server.js',
      'src/config/config.js',
      'src/config/plugins.json',
      'src/config/config.prod.js',
      'src/config/config.dev.js'
    ]

    files.forEach(file => {
      expect(path.join(tmpDir, file)).be.a.file()
    })
  })

  /**
   * Test add command
   */
  it('add', async function () {
    const file = path.join(pluginsConfigPath, PLUGINS_CONFIG_FILE)
    // Check start config
    let plugins = JSON.parse(await asyncReadFile(file, 'utf8'))
    if (plugins[PLUGIN_NAME]) throw new Error('Invalid plugins.json')

    // Run cli add command
    const cli = new Cli(['', '', 'add', PLUGIN_NAME, '--config', pluginsConfigPath])
    await cli.init()
    await cli.run()

    // Test result
    plugins = JSON.parse(await asyncReadFile(path.join(pluginsConfigPath, PLUGINS_CONFIG_FILE), 'utf8'))
    expect(plugins).be.a('object')
    expect(plugins[PLUGIN_NAME]).not.be.undefined()
    expect(plugins[PLUGIN_NAME]).eql({ local: true })
  })

  /**
   * Test disable command
   */
  it('disable', async function () {
    // Check start config
    let plugins = JSON.parse(await asyncReadFile(path.join(pluginsConfigPath, PLUGINS_CONFIG_FILE), 'utf8'))
    if (plugins[PLUGIN_NAME] === undefined || plugins[PLUGIN_NAME].local !== true) throw new Error('Invalid plugins.json')

    // Run cli disable command
    const cli = new Cli(['', '', 'disable', PLUGIN_NAME, '--config', pluginsConfigPath])
    await cli.init()
    await cli.run()

    // Test result
    plugins = JSON.parse(await asyncReadFile(path.join(pluginsConfigPath, PLUGINS_CONFIG_FILE), 'utf8'))
    expect(plugins).be.a('object')
    expect(plugins[PLUGIN_NAME]).not.be.undefined()
    expect(plugins[PLUGIN_NAME].enabled).be.false()
  })

  /**
   * Test enable command
   */
  it('enable', async function () {
    // Check start config
    let plugins = JSON.parse(await asyncReadFile(path.join(pluginsConfigPath, PLUGINS_CONFIG_FILE), 'utf8'))
    if (plugins[PLUGIN_NAME] === undefined || plugins[PLUGIN_NAME] === true) throw new Error('Invalid plugins.json')

    // Run cli enable command
    const cli = new Cli(['', '', 'enable', PLUGIN_NAME, '--config', pluginsConfigPath])
    await cli.init()
    await cli.run()

    // Test result
    plugins = JSON.parse(await asyncReadFile(path.join(pluginsConfigPath, PLUGINS_CONFIG_FILE), 'utf8'))
    expect(plugins).be.a('object')
    expect(plugins[PLUGIN_NAME]).not.be.undefined()
    expect(plugins[PLUGIN_NAME]).eql({ local: true })
  })

  /**
   * Test rm command
   */
  it('rm', async function () {
    // Check start config
    let plugins = JSON.parse(await asyncReadFile(path.join(pluginsConfigPath, PLUGINS_CONFIG_FILE), 'utf8'))
    if (plugins[PLUGIN_NAME] === undefined) throw new Error('Invalid plugins.json')

    // Run cli rm command
    const cli = new Cli(['', '', 'rm', PLUGIN_NAME, '--config', pluginsConfigPath])
    await cli.init()
    await cli.run()

    // Test result
    plugins = JSON.parse(await asyncReadFile(path.join(pluginsConfigPath, PLUGINS_CONFIG_FILE), 'utf8'))
    expect(plugins).be.a('object')
    expect(plugins[PLUGIN_NAME]).be.undefined()
  })
})
