
import Emittery from 'emittery'

import utils from '@midgar/utils'
import loadConfig from './libs/config'
import Logger from './libs/logger'
import PluginManager from './libs/plugin-manager'

/**
 * Midgar Class
 * Manage Config, plugin manager, logeer and events
 * @class
 */
class Midgar extends Emittery {
  constructor () {
    super()

    /**
     * Config instance
     * @type {Config}
     */
    this.config = null

    /**
     * Logger instance
     * @type {Logger}
     */
    this.logger = null

    /**
     * Plugin manager instance
     * @type {PluginManager}
     */
    this.pm = null

    /**
     * Commander instance
     * @type {Commander}
     * @see {@link https://www.npmjs.com/package/commander|commander doc}
     */
    this.cli = null

    // watch process to prevent crash and gracefull exit
    this._watchProcessExit()
  }

  /**
   * Start Midgar
   *
   * Load the config, init logger and plugin manager
   *
   * @param {Sting} configPath config dir path
   *
   * @return {Promise<void>}
   */
  async start (configPath) {
    await this.loadConfig(configPath)
    await this.initLogger()
    await this.initPluginManager()
  }

  /**
   * load the config
   *
   * @return {Promise<void>}
   */
  async loadConfig (dirPath) {
    // set the config dir
    this.configPath = dirPath

    // Load the configs
    this.config = await loadConfig(dirPath, this.getNodeEnv())

    process.env.TZ = this.config.tz || 'Europe/Paris'

    this.config.log.level = this.config.log && this.config.log.level ? this.config.log.level : 'warn'

    if (!this.config.pm) this.config.pm = {}

    if (this.config.pluginsLocalPath === undefined) throw new Error('@midgar/midgar: Missing pluginsLocalPath in Midgar config !')
    if (typeof this.config.pluginsLocalPath !== 'string') throw new TypeError('@midgar/midgar: Invalid pluginsLocalPath type in Midgar config !')
  }

  /**
   * Create logger instace and init
   *
   * @return {Promise<void>}
   */
  async initLogger () {
    // Check config is loaded
    if (this.config === null) throw new Error('@midgar/midgar: Load config before init logger !')

    this.logger = this.config.logger ? this.config.logger(this.config.log) : new Logger(this.config.log)
    await this.logger.init()
  }

  /**
   * Init plugin manager
   *
   * @return {Promise<void>}
   */
  async initPluginManager () {
    // Check load stat
    if (this.config === null) throw new Error('@midgar/midgar: Load config before init pm !')
    if (this.logger === null) throw new Error('@midgar/midgar: Init logger before init pm !')

    utils.timer.start('midgar-init')
    this.debug('@midgar/midgar: init PluginManager...')

    // Create plugin manager instance and init
    this.pm = this._createPmInstance()
    await this.pm.init()

    /**
     * afterInit event.
     * @event @midgar/midgar:afterInit
     */
    await this.emit('@midgar/midgar:afterInit')

    const time = utils.timer.getTime('midgar-init')
    this.debug(`@midgar:midgar: PluginManager init in ${time} ms.`)
  }

  /**
   * Create Plugin manager instance
   *
   * @return {PluginManager}
   * @protected
   */
  _createPmInstance () {
    return new PluginManager(this)
  }

  /**
   * Add a plugin in the plugins.json config file
   * Return true if the plugin was added or false
   *
   * @param {string} name Plugin name
   *
   * @return {Promise<boolean>}
   */
  addPlugin (name) {
    // Instance pm if not exist for plugin cli command
    const pm = this.pm ? this.pm : this._createPmInstance()
    return pm.addPlugin(name)
  }

  /**
   * Remove a plugin from the plugins.json config file
   * Return true if the plugin was removed or false
   *
   * @param {string} name Plugin name
   *
   * @return {Promise<boolean>}
   */
  async removePlugin (name) {
    // Instance pm if not exist for plugin cli command
    const pm = this.pm ? this.pm : this._createPmInstance()
    return pm.removePlugin(name)
  }

  /**
   * Enable a plugin in the plugins.json config file
   * Return true if the plugin was enabled or false
   *
   * @param {string} name Plugin name
   *
   * @return {Promise<boolean>}
   */
  async enablePlugin (name) {
    // Instance pm if not exist for plugin cli command
    const pm = this.pm ? this.pm : this._createPmInstance()
    return pm.enablePlugin(name)
  }

  /**
   * Disable a plugin in the plugins.json config file
   * Return true if the plugin was enabled or false
   *
   * @param {string} name Plugin name
   *
   * @return {Promise<boolean>}
   */
  async disablePlugin (name) {
    // Instance pm if not exist for plugin cli command
    const pm = this.pm ? this.pm : this._createPmInstance()
    return pm.disablePlugin(name)
  }

  /**
   * Return the node env code
   *
   * @return {string}
   */
  getNodeEnv () {
    return process.env.NODE_ENV
  }

  /**
   * Exit
   * Wait for the logger gracefull exit the process
   *
   * @return {Promise<void>}
   */
  async exit () {
    // Check load stat
    if (this.pm === null) throw new Error('@midgar/midgar: Start Midgar before stop !')

    // Stop servers if there a runing
    await this.stop()

    if (this.logger && this.logger.exit && !this._hasExitLogger) {
      this._hasExitLogger = true
      await this.logger.exit()
    }

    // exit process
    process.exit(0)
  }

  /**
   * Stop Midgar
   *
   * @return {Promise<void>}
   */
  async stop () {
    /**
     * stop event.
     * @event @midgar/midgar:stop
     */
    await this.emit('@midgar/midgar:stop')
  }

  /**
   * listen process exit signal signal and graceful exit
   * @private
   */
  _watchProcessExit () {
    process.stdin.resume()// prevent program close instantly

    // exit handler
    const exitHandler = () => {
      // flag exit to prevent multiple exit signals
      if (!this._exit) { this._exit = true } else { return }
      // start exit sequence
      this.exit()
    }

    // Catch uncaught Exceptions
    const uncaughtExceptionHandler = (error) => {
      if (this.logger) {
        // log exception
        this.logger.error('Uncaught Exception :(')
        this.logger.error(error)
      } else {
        console.error(error)
      }
      process.exit()
    }
    // Catch uncaught Exceptions
    const uncaughtRejectionHandler = (error) => {
      if (this.logger) {
        // log exception
        this.logger.error('Uncaught Rejection :(')
        this.logger.error(error)
      } else {
        console.error(error)
      }

      process.exit()
    }

    // app is closing like process.exit()
    process.on('exit', exitHandler.bind(null))
    // ctrl+c event
    process.on('SIGINT', exitHandler.bind(null))
    // kill pid
    process.on('SIGUSR1', exitHandler.bind(null))
    process.on('SIGUSR2', exitHandler.bind(null))
    // uncaught exceptions
    process.on('uncaughtException', uncaughtExceptionHandler.bind(null))
    process.on('unhandledRejection', uncaughtRejectionHandler.bind(null))
  }

  /**
   * Log an error  message
   * @param  {...any} args
   */
  error (...args) {
    this.logger.error(...args)
  }

  /**
   * Log a warning message
   * @param  {...any} args
   */
  warn (...args) {
    this.logger.warn(...args)
  }

  /**
   * Log an info  message
   * @param  {...any} args
   */
  info (...args) {
    this.logger.info(...args)
  }

  /**
   * Log a verbose message
   * @param  {...any} args
   */
  verbose (...args) {
    this.logger.verbose(...args)
  }

  /**
   * Log a debug message
   * @param  {...any} args
   */
  debug (...args) {
    this.logger.debug(...args)
  }

  /**
   * Log a silly message
   * @param  {...any} args
   */
  silly (...args) {
    this.logger.silly(...args)
  }
}

export default Midgar
