
import express from 'express'
import bodyParser from 'body-parser'
import helmet from 'helmet'
import http from 'http'
import https from 'https'
import Emittery from 'emittery'

import utils from '@midgar/utils'
import Config from './libs/config'
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
     * Express instance for the front webserver
     * @type {Express}
     * @see {@link http://expressjs.com/en/api.html|express doc}
     */
    this.app = null

    /**
     * Http server
     * @type {http.Server}
     */
    this.webServer = null

    /**
     * Commander instance
     * @type {Commander}
     * @see {@link https://www.npmjs.com/package/commander|commander doc}
     */
    this.cli = null

    /**
     * Config load flag
     * @type {Boolean}
     * @private
     */
    this._configLoaded = false

    // watch process to prevent crash and gracefull exit
    this._watchProcessExit()
  }

  /**
   * load the config
   */
  async loadConfig (dirPath) {
    // set the config dir
    this.configPath = dirPath
    this.config = new Config(this)

    // Load the configs
    await this.config.loadConfigs(dirPath, 'config', true)

    process.env.TZ = this.config.tz || 'Europe/Paris'

    // Web serveur base config
    this.config.web = utils.assignRecursive({
      host: 'localhost',
      port: '80',
      ssl: false
    }, this.config.web || {})

    // Check minimal config
    this.config.web.baseUrl = (this.config.web.ssl ? 'https' : 'http') + '://' + this.config.web.host
    if (this.config.web.port !== 80 || (this.config.web.ssl && this.config.web.port !== 443)) {
      this.config.web.baseUrl += ':' + this.config.web.port
    }

    this.config.log.level = this.config.log && this.config.log.level ? this.config.log.level : 'warn'

    if (!this.config.plugin || !this.config.plugin.dir) throw new Error('No plugin dir in config !')

    // Flag config loaded
    this._configLoaded = true
  }

  /**
   * Create logger instace and init
   */
  async initLogger () {
    // Create the logger instance
    this.logger = this.config.logger ? this.config.logger(this.config.log) : new Logger(this.config.log)

    await this.logger.init()
  }

  /**
   * @description Init plugin manager
   */
  async initPluginManager () {
    utils.timer.start('midgar-init')
    this.debug('init...')

    // Check config is loaded
    if (!this._configLoaded) {
      throw new Error('config not loaded !')
    }

    // Init the plugin manager
    await this._initPluginManager()

    /**
     * afterInit event.
     * @event @midgar/midgar:afterInit
     */
    await this.emit('@midgar/midgar:afterInit')

    const time = utils.timer.getTime('midgar-init')
    this.debug('midgar has init in ' + time + ' ms')
  }

  /**
   * Init plugin manager
   * @private
   */
  async _initPluginManager () {
    this.pm = new PluginManager(this)
    await this.pm.init()
  }

  /**
   * Add a plugin in the plugins.json config file
   * Return true if the plugin was added or false
   *
   * @param {String} name Plugin name
   *
   * @return {Boolean}
   */
  addPlugin (name) {
    // Instance pm if not exist for plugin cli command
    const pm = this.pm ? this.pm : new PluginManager(this)
    return pm.addPlugin(name)
  }

  /**
   * Remove a plugin from the plugins.json config file
   * Return true if the plugin was removed or false
   *
   * @param {String} name Plugin name
   *
   * @return {Boolean}
   */
  async removePlugin (name) {
    // Instance pm if not exist for plugin cli command
    const pm = this.pm ? this.pm : new PluginManager(this)
    return pm.removePlugin(name)
  }

  /**
   * Enable a plugin in the plugins.json config file
   * Return true if the plugin was enabled or false
   *
   * @param {String} name Plugin name
   *
   * @return {Boolean}
   */
  async enablePlugin (name) {
    // Instance pm if not exist for plugin cli command
    const pm = this.pm ? this.pm : new PluginManager(this)
    return pm.enablePlugin(name)
  }

  /**
   * Disable a plugin in the plugins.json config file
   * Return true if the plugin was enabled or false
   *
   * @param {String} name Plugin name
   *
   * @return {Boolean}
   */
  async disablePlugin (name) {
    // Instance pm if not exist for plugin cli command
    const pm = this.pm ? this.pm : new PluginManager(this)
    return pm.disablePlugin(name)
  }

  /**
   * Create the express app and add some middlewares
   */
  async initWebServer () {
    utils.timer.start('midgar-init-web-serv')
    this.debug('midgar.initWebServer()')
    // express instance
    this.app = express()

    if (this.config.helmet === undefined || this.config.helmet) {
      // default options
      let helmetOptions = {}
      if (this.config.helmet !== undefined && this.config.helmet.constructor === ({}).constructor) {
        helmetOptions = this.config.helmet
      }
      this.app.use(helmet(helmetOptions))
    }

    if (this.config.jsonBodyParser === undefined || this.config.jsonBodyParser) {
      this.app.use(bodyParser.json()) // support json encoded bodies
    }

    if (this.config.urlencodedBodyParser === undefined || this.config.urlencodedBodyParser) {
      // default options
      let urlencodedOptions = { extended: true }
      if (this.config.urlencodedBodyParser !== undefined && this.config.urlencodedBodyParser.constructor === ({}).constructor) {
        urlencodedOptions = this.config.urlencodedBodyParser
      }
      this.app.use(bodyParser.urlencoded(urlencodedOptions)) // support encoded bodies
    }

    this.debug('Call @midgar/midgar:initHttpServer event')

    /**
     * initHttpServer event.
     * Used to attach middleware on express
     *
     * @event @midgar/midgar:initHttpServer
     */
    await this.emit('@midgar/midgar:initHttpServer')

    // /!\ remove next arg cause res.status is not a function
    this.app.use((err, req, res, next) => {
      this.error(err)
      this.error('No route or error handler found !')
      res.status(500).send('Internal Server Error')
    })

    const time = utils.timer.getTime('midgar-init-web-serv')
    this.debug('midgar has init web server in ' + time + ' ms')
  }

  /**
   * Return the node env code
   * @return {string}
   */
  getNodeEnv () {
    return process.env.NODE_ENV
  }

  /**
   * Load the config, init logger and plugin manager
   *
   * @param {Sting} configPath
   */
  async init (configPath) {
    await this.loadConfig(configPath)
    await this.initLogger()
    await this.initPluginManager()
  }

  /**
   * Start Midgar
   *
   * Init Midgar, init webserver and start them
   *
   * @param {Sting} configPath config dir path
   */
  async start (configPath) {
    await this.init(configPath)
    // Init and start servers
    await this.initWebServer()
    await this.startWebServer()
  }

  /**
   * Start front web serveur
   */
  async startWebServer () {
    const opts = {
      port: this.config.web.port,
      host: this.config.web.host,
      ssl: !!this.config.web.ssl,
      baseUrl: this.config.web.baseUrl
    }

    if (this.config.web.sslKey) {
      opts.sslKey = this.config.web.sslKey
    }

    if (this.config.web.sslCert) {
      opts.sslCert = this.config.web.sslCert
    }

    try {
      this.webServer = await this._startWebServer(this.app, opts)
    } catch (error) {
      this.error('Cannot start the web server')
      this.error(error)
      process.exit()
    }

    this.info('Web server live on ' + opts.port)
    this.info(this.config.web.baseUrl)
  }

  /**
   * Listen http requestion on a port
   * @private
   */
  async _startWebServer (app, opts) {
    if (!opts.ssl) {
      const server = http.createServer(app)
      await server.listen(opts.port)
      return server
    } else {
      const server = https.createServer({
        key: opts.sslKey,
        cert: opts.sslCert
      }, app)

      await server.listen(opts.port, opts.host)
      return server
    }
  }

  /**
   * Exit
   * Wait for the logger gracefull exit the process
   */
  async exit () {
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
   * Stop web server
   */
  stop () {
    return this._stop(this.webServer)
  }

  /**
   * Stop an http server
   * @param {http.Server} server Server to stop
   * @private
   */
  _stop (server) {
    return new Promise((resolve, reject) => {
      if (!server) return resolve()
      try {
        server.close(() => {
          resolve()
        })
      } catch (error) {
        reject(error)
      }
    })
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
