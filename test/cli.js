import { describe, it } from 'mocha'
import chai from 'chai'
import dirtyChai from 'dirty-chai'
import chaiFs from 'chai-fs'
import chaiAsPromised from 'chai-as-promised'
import path from 'path'
import _rimraf from 'rimraf'
import os from 'os'
import uid from 'uid-safe'
import inquirer from 'inquirer'

import Cli from '../src/libs/cli'
import { asyncReadFile, asyncWriteFile } from '@midgar/utils'
import { PLUGINS_CONFIG_FILE } from '../src/libs/plugin-manager'
import { getPluginClassName } from '../src/cli/plugin'
import { util } from 'chai/lib/chai'

const PLUGIN_NAME = '@test/test-plugin-2'
const NEW_PLUGIN_NAME = 'my-plugin'
const NEW_OTHER_PLUGIN_NAME = 'my-other-plugin'
const PROJECT_NAME = 'my-project'

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
  return path.join(os.tmpdir(), uid.sync(8))
}

const pluginsClassData = [
  {
    name: 'test',
    className: 'TestPlugin'
  },
  {
    name: 'test/test',
    className: 'TestPlugin'
  },
  {
    name: 'testCamel',
    className: 'TestCamelPlugin'
  },
  {
    name: 'TestPascal',
    className: 'TestPascalPlugin'
  },
  {
    name: '@test/testTest',
    className: 'TestTestPlugin'
  },
  {
    name: 'test-kebab',
    className: 'TestKebabPlugin'
  },
  {
    name: 'test_snake',
    className: 'TestSnakePlugin'
  },
  {
    name: 'TesT_MiX-casE',
    className: 'TesTMiXCasEPlugin'
  }
]

let tmpDir = null
const configPath = path.resolve(__dirname, 'fixtures/config')
const pluginsConfigPath = path.resolve(__dirname, 'fixtures/config-plugins')
const logs = []
let consoleLog = null

/**
 * Test new plugin command
 *
 * @param {string} pluginName Plugin name
 * @param {Cli}    cli        Cli instance
 * @private
 */
async function testNewPlugin (pluginName, cli) {
  const files = [
    'package.json',
    '.gitignore',
    '.eslintrc.js',
    'src/index.js',
  ]

  const pluginPath = path.join(cli.mid.pm.localPath, pluginName)
  files.forEach(file => {
    expect(path.join(pluginPath, file)).be.a.file()
  })

  // Check plugin package.json
  let { default: pkg } = await import(path.join(pluginPath, 'package.json'))
  expect(pkg.name).equal(pluginName, 'Invalid package name !')
  expect(pkg.main).equal('src/index.js', 'Invalid package main !')
  expect(pkg.scripts).not.be.undefined('Invalid package scripts !')
  expect(pkg.scripts.postinstall).equal('midgar add ' + pluginName, 'Invalid package postinstall script !')
  expect(pkg.scripts.preuninstall).equal('midgar rm ' + pluginName, 'Invalid package postinstall script !')
  expect(pkg.dependencies).not.be.undefined('Invalid package dependencies !')
  expect(pkg.dependencies['@midgar/midgar']).not.be.undefined('Invalid package missing Midgar dependency !')
  expect(pkg.private).be.true('Invalid package private !')
}

/**
 * Cli tests
 */
describe('Cli', function () {
  before(async () => {
    // mok console
    consoleLog = console.log
    console.log = (msg) => {
      logs.push(msg)
    }

    // Create tmp dir
    tmpDir = getTmpDir()
    await asyncWriteFile(path.join(pluginsConfigPath, PLUGINS_CONFIG_FILE), '{}')
  })

  after(async () => {
    console.log = consoleLog
    // clean tmp dir
    await rimraf(tmpDir)
    await asyncWriteFile(path.join(pluginsConfigPath, PLUGINS_CONFIG_FILE), '{}')
  })

  /**
   * Test invalid command
   */
  it('Invalid command', async function () {
    let argv = ['', '', 'invalidcmd']
    const cwd = path.resolve(__dirname)
    let cli = new Cli(argv, cwd)
    await cli.init()
    await expect(cli.run()).be.rejectedWith('Invalid command: invalidcmd\n--config option is not set, see --help for a list of available commands.')

    argv = ['', '', '--config', pluginsConfigPath, 'invalidcmd']
    cli = new Cli(argv, cwd)
    await cli.init()
    await expect(cli.run()).be.rejectedWith('Invalid command: invalidcmd\nSee --help for a list of available commands.')
  })

  /**
   * Test init command
   */
  it('init', async function () {
    // Call init cli command on tmp dir
    let cli = new Cli(['', '', 'init', tmpDir], tmpDir)

    // Mok inquirer.prompt
    const originalPrompt = inquirer.prompt
    inquirer.prompt = async () => { return { projectName: PROJECT_NAME }}

    await cli.init()
    await cli.run()

    // process.stdin.write(projectName)

    // Check if all template files are created
    const files = [
      'package.json',
      '.gitignore',
      '.eslintrc.js',
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

    const { default: pkg } = await import(path.join(tmpDir, 'package.json'))
    expect(pkg.name).equal(PROJECT_NAME, 'Invalid package name !')
    expect(pkg.midgar).not.be.undefined('Invalid package midgar entry !')
    expect(pkg.midgar.config).not.be.undefined('Invalid package midgar config entry !')
    expect(pkg.midgar.config).equal('./src/config', 'Invalid package midgar config entry !')
    expect(pkg.dependencies).not.be.undefined('Invalid package dependencies !')
    expect(pkg.dependencies['@midgar/midgar']).not.be.undefined('Invalid package missing Midgar dependency !')
    expect(pkg.private).be.true('Invalid package private !')

    // Call init cli command on tmp dir
    cli = new Cli(['', '', 'init', tmpDir], tmpDir)
    await cli.init()
    await expect(cli.run()).be.rejectedWith(`The directory ${tmpDir} is not empty !`)

    inquirer.prompt = originalPrompt
  })

  /**
   * Test new command
   */
  it('new', async function () {
    // Test getPluginClassName function
    for (const data of pluginsClassData) {
      const className = getPluginClassName(data.name)
      expect(className).equal(data.className, 'Invalid Plugin Class Name !')
    }

    // Call new cli command on tmp dir
    let cli = new Cli(['', '', 'new'], tmpDir)

    // Mok inquirer.prompt
    const originalPrompt = inquirer.prompt
    inquirer.prompt = async () => { return { pluginName: NEW_PLUGIN_NAME }}

    await cli.init()
    await cli.run()
    await testNewPlugin(NEW_PLUGIN_NAME, cli)
    // process.stdin.write(NEW_PLUGIN_NAME)

    // Check if all template files are created

    // Check project package.json
    let pkg = await import(path.join(tmpDir, 'package.json'))
    pkg = pkg.default
    expect(pkg.name).equal(PROJECT_NAME, 'Invalid package name !') 
    expect(pkg.dependencies).not.be.undefined('Invalid package dependencies !')
    expect(pkg.dependencies[NEW_PLUGIN_NAME]).not.be.undefined('Invalid package missing Midgar dependency !')

    // Test plugin name in cmd argument
    cli = new Cli(['', '', 'new', NEW_OTHER_PLUGIN_NAME], tmpDir)
    await cli.init()
    await cli.run()
    await testNewPlugin(NEW_OTHER_PLUGIN_NAME, cli)

    // Test create existing plugin
    cli = new Cli(['', '', 'new', NEW_OTHER_PLUGIN_NAME], tmpDir)
    await cli.init()

    const pluginPath = path.join(cli.mid.pm.localPath, NEW_OTHER_PLUGIN_NAME)
    await expect(cli.run()).be.rejectedWith(`Directory ${pluginPath} already exists !`)

    inquirer.prompt = originalPrompt
  })

  
  /**
   * Test cli get config path from package.json file
   */
  it('package config', async function () {
    const argv = ['', '', 'test']
    const cli = new Cli(argv, path.join(tmpDir, 'src/plugins', NEW_PLUGIN_NAME, 'src'))
    await cli.init()
    expect(cli.mid.configPath).equal(path.join(tmpDir, 'src/config'), 'Invalid config path')
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
