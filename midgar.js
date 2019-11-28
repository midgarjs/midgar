const express = require('express')
const bodyParser = require('body-parser')
const helmet = require('helmet')
const url = require('url')
const cluster = require('cluster')
const htmlencode =  require('htmlencode').htmlEncode
const EventEmitter = require('events')
const http = require('http')
const https = require('https')

const utils = require('@midgar/utils')
const Config = require('./libs/config')
const Logger = require('./libs/logger')
const PluginManager = require('./libs/plugin-manager')

/**
 * Midgar Class
 * Manage cluster, plugins and servers
 */
class Midgar extends EventEmitter {
  constructor() {
    super()

    /**
     * Cluster Object
     * @type {Object}
     * @see {@link https://nodejs.org/docs/latest/api/cluster.html|node js doc}
     */
    this.cluster = cluster

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
     * @type {Object}
     * @see {@link http://expressjs.com/en/api.html|express doc}
     */
    this.app = null

    /**
     * Express instance for the public webserver
     * @type {Object}
     * @see {@link http://expressjs.com/en/api.html|express doc}
     */
    this.publicApp = null

    /**
     * Http server
     * @type {http.Server} 
     */
    this.webServer = null

    /**
     * Http server for public files
     * @type {http.Server} 
     */
    this.publicServer = null

    /**
     * Midgar data object
     * @type {Object}
     * @private
     */
    this._data = []

    /**
     * Yargs instance
     */
    this.cli = null

    /**
     * Config load flag
     * @type {Boolean}
     * @private
     */
    this._configLoaded = false

    //watch process to prevent crash and gracefull exit
    this._watchProcessExit()
  }

  /**
   * load the config
   */
  async loadConfig(dirPath) {
    //set the config dir
    this.configPath = dirPath
    this.config = new Config(this)

    // Load the configs
    await this.config.loadConfigs(dirPath, 'config', true)

    process.env.TZ = this.config.tz || 'Europe/Paris'
    
    if (!this.config.web) {
      this.config.web = {}
    }
    
    // Web serveur base config
    this.config.web = utils.assignRecursive({
      host: 'localhost',
      port: '80',
      ssl: false
    }, this.config.web || {})

    // Peublic web serveur base config
    this.config.public = utils.assignRecursive({
      host: 'localhost',
      port: '81',
      ssl: false
    }, this.config.public || {})

    // Check minimal config
    this.config.web.baseUrl = (this.config.web.ssl ? 'https': 'http') + '://' + this.config.web.host
    if (this.config.web.port != 80 || (this.config.web.ssl && this.config.web.port != 443)) {
      this.config.web.baseUrl += ':' + this.config.web.port
    }
    
    this.config.public.baseUrl = (this.config.public.ssl ? 'https': 'http') + '://' + this.config.public.host
    if (this.config.public.port != 80 || (this.config.public.ssl && this.config.public.port != 443)) {
      this.config.public.baseUrl += ':' + this.config.public.port
    }

    if (!this.config.log || !this.config.log.level) {
      this.config.log.level = 'warn'
    }

    if (!this.config.plugin || !this.config.plugin.dir) {
      throw new Error ('No plugin.dir')
    }

    // Flag config loaded
    this._configLoaded = true
  }

  /**
   * Create logger instace and init
   */
  async initLogger() {
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
     * afterMidgarInit event.
     *
     * @event Midgar#afterMidgarInit
     */
    await this.pm.emit('afterMidgarInit')
     
    const time = utils.timer.getTime('midgar-init')
    this.debug('midgar has init in ' + time[0] + 's, ' +  time[1] + 'ms')
  }
  
  /**
   * @private
   * @description Init plugin manager
   */
  async _initPluginManager() {
    this.pm = new PluginManager(this)
    await this.pm.init()
  }

  /**
   * 
   * @param {*} plugin 
   */
  async addPlugin(plugin) {
    const pm = new PluginManager(this)
    await pm.addPlugin(plugin)
  }

  /**
   * Create the express app and add some middlewares
   */
  async initWebServer() {
    utils.timer.start('midgar-init-web-serv')
    this.debug('midgar.initWebServer()')
    //express instance
    this.app = express()
    
    if (this.config.public && this.config.public.enable) {
      //express instance for the public server
      this.publicApp = express()
      this.publicApp.use(function(req, res, next) {
        res.header('Access-Control-Allow-Origin', '*')
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
        next()
      })
    }

    this.app.use(helmet())

    this.app.use(bodyParser.json()) // support json encoded bodies
    this.app.use(bodyParser.urlencoded({
      extended: true
    })) // support encoded bodies

    /**
     * Add a function on requeste to gest post and get parameters
     */
    this.app.use((req, res, next) => {
      // Set Midgar intance on request object
      req.midgar = this
      // add method to get clean request param
      req.getParam = (key, cleanParams = true) => {

        if (cleanParams && req.cleanParams && req.cleanParams[key])
          return req.cleanParams[key]

        let value = null
        if (req.query[key] != undefined)
          value = req.query[key]
        else if (req.body[key] != undefined)
          value = req.body[key]

        if (value !== null && cleanParams) {
          value = this._cleanParam(value)
          if (!req.cleanParams)
            req.cleanParams = {}
          
          req.cleanParams[key] = value
        }

        return value
      }
      next()
    })

    /**
     * initHttpServer event.
     * Used to attach middleware on express
     *
     * @event Midgar#initHttpServer
     */
    await this.pm.emit('initHttpServer')

    /**
     * afterInitHttpServer event.
     *
     * @event Midgar#afterInitHttpServer
     */
    // await this.pm.emit('afterInitHttpServer')
    
    this.app.use((err , req, res, next) => {
      this.error(err)
    });
    
    const time = utils.timer.getTime('midgar-init-web-serv')
    this.debug('midgar has init web server in ' + time[0] + 's, ' +  time[1] + 'ms')
  }

  /**
   * @param {*} value 
   * @private
   */
  _cleanParam(value) {
    if (typeof value === 'object') {
      const obj = {}
      const keys = Object.keys(value)
      for (const i in keys) {
        let key = keys[i]
        key = htmlencode(key)
        obj[key] = htmlencode(value[key])
      }
      return obj 
    } else {
      return htmlencode(value)
    }
  }

  /** 
   * Return the env code
   * @return {string}
   */
  getModeEnv() {
    return process.env.MODE_ENV
  }

  /**
   * Start public server and front server
   * 
   * the public server start only if it enabled in the config
   */
  async startServers() {
    /**
     * beforeStartServers event.
     *
     * @event Midgar#beforeStartServers
     */
    await this.pm.emit('beforeStartServers')

    const promises = [] 
    if (this.config.public && this.config.public.enable) {
      promises.push(this.startPublicServer())
    }
    
    promises.push(this.startWebServer())

    await Promise.all(promises)
  }

  /**
   * Load the config, init logger and plugin manager
   * 
   * @param {Sting} configPath 
   */
  async init(configPath) {
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
  async start(configPath) {
    await this.init(configPath)
    // Init and start servers
    await this.initWebServer()
    await this.startServers()
  }

  /**
   * Start front web serveur
   */
  async startWebServer() {
    const opts = {
      port: this.config.web.port,
      host: this.config.web.host,
      ssl: this.config.web.ssl ? true : false,
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
   * @description Start public web serveur
   */
  async startPublicServer() {
    //set the public dir
    this.publicApp.use(this.config.public.virtualPath ? this.config.public.virtualPath: '/', express.static(this.config.public.path))
    const opts = {
      port: this.config.public.port,
      host: this.config.public.host,
      ssl: this.config.public.ssl ? true : false,
      baseUrl: this.config.public.baseUrl
    }

    if (this.config.public.sslKey) {
      opts.sslKey = this.config.public.sslKey
    }

    if (this.config.public.sslCert) {
      opts.sslCert = this.config.public.sslCert
    }

    try {
      this.publicServer = await this._startWebServer(this.publicApp, opts)
    } catch (error) {
      this.error('Cannot start the public web server')
      this.error(error)
      process.exit()
    }


    this.info('Server public live on ' + this.config.public.port)
    this.info(this.config.public.path + ' => ' + this.config.public.baseUrl)
  }

  /**
   * Listen http requestion on a port
   * @private
   */
  async _startWebServer(app, opts) {
    if (!opts.ssl) {
        const server = http.createServer(app)
        await server.listen(opts.port)
        return server
    } else {
      const server = https.createServer({
        key: opts.sslKey,
        cert: opts.sslCert,
      }, app)
      
      await server.listen(opts.port, opts.host)
      return server
    }
  }

  /**
   * Exit
   * Wait for the logger gracefull exit the process
   */
  async exit() {
    // Stop servers if there a runing  
    await this.stop()

    if (this.logger && this.logger.exit && !this._hasExitLogger) {
      this._hasExitLogger = true
      await this.logger.exit()
    } 

    //exit process 
    process.exit(0)
  }

  /**
   * Stop public and web server
   */
  async stop() {
    if (this.publicServer) {
      await this._stop(this.publicServer)
    }

    if (this.webServer) {
      await this._stop(this.webServer)
    }
  }

  /**
   * Stop an http server
   * @param {http.Server} server Server to stop
   */
  _stop(server) {
    return new Promise((resolve, reject) => {
      try {
        server.close(() => {
          resolve()
        })
      } catch(error) {
        console.log(error)
        reject(error)
      }
    })
  }

  /**
   * listen process exit signal signal and graceful exit 
   * 
   * @private
   */
  _watchProcessExit() {
      process.stdin.resume()//prevent program close instantly

      //exit handler
      const exitHandler = () => {
        //flag exit to prevent multiple exit signals      
        if (!this._exit) 
          this._exit = true
        else
          return
       //start exit sequence
        this.exit()
      }

      //Catch uncaught Exceptions
      const uncaughtExceptionHandler = (error) => {
        if (this.logger) {
          //log exception
          this.logger.error('Uncaught Exception :(')
          this.logger.error(error)
        } else {
          console.error(error)
        }
        process.exit()
      }
      //Catch uncaught Exceptions
      const uncaughtRejectionHandler = (error) => {
        if (this.logger) {
          //log exception
          this.logger.error('Uncaught Rejection :(')
          this.logger.error(error)
        } else {
          console.error(error)
        }

        process.exit()
      }

      //app is closing like process.exit()
      process.on('exit', exitHandler.bind(null))
      //ctrl+c event
      process.on('SIGINT', exitHandler.bind(null))
      //kill pid
      process.on('SIGUSR1', exitHandler.bind(null))
      process.on('SIGUSR2', exitHandler.bind(null))
      //uncaught exceptions
      process.on('uncaughtException', uncaughtExceptionHandler.bind(null))
      process.on('unhandledRejection', uncaughtRejectionHandler.bind(null))
      
  }

  /**
   * Return a full url for a route
   * 
   * @param {sting}  route   route
   * @param {object} options options
   */
  url (route /*, options = {}*/) {
    return url.resolve(this.config.web.baseUrl, route)
  }

  /**
   * Set data in the data object
   * 
   * @param {sting} key Data key
   * @param {*}     data 
   */
  setData(key, data) {
    this._data[key] = data
  }

  /**
   * Return data from the data object
   * 
   * @param {sting} key Data key
   * @return {*}
   */
  getData(key) {
    return this._data[key] != undefined ? this._data[key] : null
  }

  /**
   * Log an error  message
   * 
   * @param  {...any} args 
   */
  error(...args) {
    this.logger.error(...args)
  }

  /**
   * Log a warning message
   * 
   * @param  {...any} args 
   */
  warn(...args) {
    this.logger.warn(...args)
  }

  /**
   * Log an info  message
   * 
   * @param  {...any} args 
   */
  info(...args) {
    this.logger.info(...args)
  }

  /**
   * Log a verbose message
   * 
   * @param  {...any} args 
   */
  verbose(...args) {
    this.logger.verbose(...args)
  }

  /**
   * Log a debug message
   * 
   * @param  {...any} args 
   */
  debug(...args) {
    this.logger.debug(...args)
  }

  /**
   * Log a silly message
   * 
   * @param  {...any} args 
   */
  silly(...args) {
    this.logger.silly(...args)
  }
}

module.exports = Midgar
