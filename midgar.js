const express = require('express')
const bodyParser = require('body-parser')
const helmet = require('helmet')
const url = require('url')
const cluster = require('cluster')
const htmlencode =  require('htmlencode').htmlEncode
const EventEmitter = require('events')

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
     * Midgar services object
     * @type {Object}
     */
    this.services = {}

    /**
     * Midgar data object
     * @type {Object}
     * @private
     */
    this._data = []

    /**
     * Config load flag
     * @type {boolean}
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
    this.config = new Config

    //Load the configs
    await this.config.loadConfigs(dirPath, 'config', true)

    process.env.TZ = this.config.tz || 'Europe/Paris'

    this.config.baseUrl = this.config.baseUrl.replace('{port}', this.config.port)
    this.config.publicBaseUrl = this.config.public.baseUrl.replace('{port}', this.config.public.port)

    //flag config loaded
    this._configLoaded = true

    //create the logger instance
    this.logger = this.config.logger ? this.config.logger(this.config.log) : new Logger(this.config.log)

    await this.logger.init().catch(error => {
      console.log(error)
      throw error
    })

    //bad things :)
    if (!this.config.log || !this.config.log.level) {
      this.config.log.level = 'warn'
    }

    if (!this.config.plugin || !this.config.plugin.dir) {
      throw new Error ('No plugin.dir')
    }
  }

  /**
   * @description Init Midgar
   */
  async init () {
    utils.timer.start('midgar-init')
    this.debug('init...')

    //check config is loaded
    if (!this._configLoaded) {
      throw new Error('config not loaded !')
    }

    //init the plugin manager
    await this._initPlugins()
    
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
  async _initPlugins() {
    this.pm = new PluginManager(this)
    await this.pm.init()
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

    //security {xssFilter:{ reportUri: '/report-xss-violation' }}
    this.app.use(helmet())

    this.app.use(bodyParser.json()) // support json encoded bodies
    this.app.use(bodyParser.urlencoded({
      extended: true
    })) // support encoded bodies



    /**
     * Add a function on requeste to gest post and get parameters
     */
    this.app.use((req, res, next) => {
      req.midgar = this
      // add method to get clean request param
      req.getParam = (key, cleanParam = true) => {

        if (leanParam && req.cleanParam && req.cleanParam[key])
          return req.cleanParam[key]

        let value = null
        if (req.query[key] != undefined)
          value = req.query[key]
        else if (req.body[key] != undefined)
          value = req.body[key]

        if (value !== null && cleanParam) {
          value = this._cleanParam(value) 
          req.cleanParam[key] = value
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
    await this.pm.emit('afterInitHttpServer')
    
    this.app.use((err, req, res, next) => {
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
  //  console.log(value)
      return htmlencode(value)
  }

  /** 
   * Return the env code
   * @return {string}
   */
  getEnv() {
    return process.env.NODE_ENV
  }

  /**
   * Start public server and front server
   * 
   * the public server start only if it enabled in the config
   */
  async startServers() {
    const promises = [] 
    if (this.config.public && this.config.public.enable) {
      promises.push(this.startPublicServer())
   
    }
    promises.push(this.startWebServer())

    await Promise.all(promises)
  }

  /**
   * Listen http requestion on a port
   * @private
   */
  _startWebServer(app, port) {
    return new Promise((resolve, reject) => {
      try {
        app.listen(port, () => {
          resolve()
        }).on('error', error => {
          reject(error)
        })
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Start Midgar
   * 
   * Load the config and start cluster for the master process
   * Workers init Midgar, init webserver and start them
   * 
   * @param {sting} configPath config dir path
   */
  async start(configPath) {
    await this.loadConfig(configPath)
      //create cluster
      if (this.cluster.isMaster) {
        await this._startCluster()
      } else {
        //init and start servers
        await this.init()
        await this.initWebServer()
        await this.startServers()
        this.info('Worker %d running!', this.cluster.worker.id)
      }
  }


  /**
   * Kill all workers
   */
  async killWorkers() {
    //list workers
    for (const id in this.cluster.workers) {
      this.warn('kill worker ' + id)
      //this.cluster.workers[id].send('exit')
      this.cluster.workers[id].kill('SIGKILL')
    }
  }

  /**
   * Create a worker
   */
  createWorker () {
    const worker = this.cluster.fork()
    const midgar = this
    // Receive messages from this worker and handle them in the master process.
    worker.on('message', function (msg) {
      if (msg.action) {
        if (msg.action == 'killworkers') {
          midgar.killWorkers()
        }
      }
    })

    // Listen for dying workers
    worker.on('exit', function (exitSign) {
      midgar.createWorker()
      // Replace the dead worker, we're not sentimental
      midgar.debug('Worker died :( (%d)', exitSign)
    })

    worker.on('error', function (exitSign) {
      midgar.createWorker()
      // Replace the dead worker, we're not sentimental
      midgar.debug('Worker %d died in error :( (%d)', exitSign)
    })
  }

  /**
   * Start cluster
   * @private
   */
  async _startCluster() {
    //only executed by master process
    // Count the machine's CPUs
    let cpuCount = require('os').cpus().length;

    //for dev it better to have only one server process
    //the watch file cause some isue with many process
    if (this.getEnv() == 'development') {
      cpuCount = 1
    }

    // Create a worker for each CPU
    for (let i = 0; i < cpuCount; i += 1) {
      this.createWorker()
    }
  }

  /**
   * @description Start front web serveur
   */
  async startWebServer() {
    const port = this.config.port || 80
    await this._startWebServer(this.app, port).catch(error => {
      this.error('Cannot start the web server')
      this.error(error)
      process.exit()
    })
    this.info('Web server live on ' + port)
    this.info(this.config.baseUrl)
  }

  /**
   * @description Start public web serveur
   */
  async startPublicServer() {
    //set the public dir
    this.publicApp.use(express.static(this.config.public.path))

    await this._startWebServer(this.publicApp, this.config.public.port).catch( error => {
      this.error('Cannot start the public web server')
      this.error(error)
      process.exit()
    })
    this.info('Server public live on ' + this.config.public.port)
    this.info(this.config.public.path + ' => ' + this.config.public.baseUrl)
  }

  /**
   * Exit
   * Wait for the logger gracefull exit the exit the process
   */
  async exit() {  
    if (this.logger && this.logger.exit && !this._hasExitLogger) {
      this._hasExitLogger = true
      await this.logger.exit()
    } 

    //exit process 
    process.exit(0)
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
  url (route, options = {}) {
    return url.resolve(this.config.baseUrl, route)
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