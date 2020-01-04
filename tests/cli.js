import mocha from 'mocha'
import chai from 'chai'
import dirtyChai from 'dirty-chai'
import chaiFs from 'chai-fs'
import path from 'path'
import _rimraf from 'rimraf'
import fs from 'fs'
import os from 'os'
import uid from 'uid-safe'

import Cli from '../src/libs/cli'
import { asyncReadFile, asyncWriteFile } from '@midgar/utils'
import { PLUGINS_CONFIG_FILE } from '../src/libs/plugin-manager'

const PLUGIN_NAME = '@test/test-plugin-2'

// fix for TypeError: describe is not a function with mocha-teamcity-reporter
const { describe, it } = mocha

// Add chai middlware
const expect = chai.expect
chai.use(chaiFs)
chai.use(dirtyChai)

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
  fs.mkdirSync(dirname, { mode: parseInt('0700', 8) })
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

  // Test init command
  it('init', async function () {
    // Call init cli command on tmp dir
    const cli = new Cli(['', '', 'init', tmpDir])
    await cli.init()
    await cli.run()

    // Check if all template files are created
    const files = [
      'package.json',
      '.gitignore',
      '.eslintrc.js',
      'yarn.lock',
      '.midrc',
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
    expect(plugins[PLUGIN_NAME]).to.not.be.undefined()
    expect(plugins[PLUGIN_NAME]).to.be.true()
  })

  it('disable', async function () {
    // Check start config
    let plugins = JSON.parse(await asyncReadFile(path.join(pluginsConfigPath, PLUGINS_CONFIG_FILE), 'utf8'))
    if (plugins[PLUGIN_NAME] === undefined || plugins[PLUGIN_NAME] !== true) throw new Error('Invalid plugins.json')

    // Run cli disable command
    const cli = new Cli(['', '', 'disable', PLUGIN_NAME, '--config', pluginsConfigPath])
    await cli.init()
    await cli.run()

    // Test result
    plugins = JSON.parse(await asyncReadFile(path.join(pluginsConfigPath, PLUGINS_CONFIG_FILE), 'utf8'))
    expect(plugins).be.a('object')
    expect(plugins[PLUGIN_NAME]).to.not.be.undefined()
    expect(plugins[PLUGIN_NAME]).to.be.false()
  })

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
    expect(plugins[PLUGIN_NAME]).to.not.be.undefined()
    expect(plugins[PLUGIN_NAME]).to.be.true()
  })

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
    expect(plugins[PLUGIN_NAME]).to.be.undefined()
  })
})

/**
 * Test if the command test of the plugin test is call
 */
describe('Test plugin command', function () {
  it('test', async function () {
    let cli = new Cli(['', '', 'test', '--config', configPath, '--topt', 'test-return-value'])
    await cli.init()
    let result = await cli.run()
    expect(result.stdout).to.have.string('test-return-value')

    cli = new Cli(['', '', 'test2', '--config', configPath])
    await cli.init()
    result = await cli.run()
    expect(result.stdout).to.have.string('cli test 2')
  })
})
