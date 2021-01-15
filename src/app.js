const Emittery = require('emittery')
const utils = require('./libs/utils')
const { loadConfig } = require('./libs/config')
const Logger = require('./libs/logger')
const PluginManager = require('./libs/plugin-manager')
const Container = require('./libs/container')

/**
 * App Class
 * Manage Config, plugin manager, logeer and events
 * @class
 */
class App extends Emittery {
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

        this._exit = false

        this._hasExitLogger = false

        /**
         * Plugin manager instance
         * @type {PluginManager}
         */
        this.pm = null

        /**
         * Container instance
         * @type {Container}
         */
        this.container = null

        // watch process to prevent crash and gracefull exit
        this._watchProcessExit()
    }

    /**
     * init App
     *
     * Load the config, init logger, DI container and plugin manager
     *
     * @param {Sting} configPath config dir path
     *
     * @return {Promise<void>}
     */
    async init (configPath) {
        await this._loadConfig(configPath)

        this.logger = this.config.logger ? this.config.logger(this.config.log) : new Logger(this.config.log)

        this.container = new Container(this)
        this.pm = new PluginManager(this)
    }

    /**
     * Start App
     *
     * @return {Promise<void>}
     */
    async start () {
        await this.pm.initPlugins()
        await this.emit('after-init-plugins')
        await this.emit('start')
    }

    /**
     * load the config
     *
     * @return {Promise<void>}
     * @private
     */
    async _loadConfig (dirPath) {
        // set the config dir
        this.configPath = dirPath

        // Load the configs
        this.config = await loadConfig(dirPath, this.getNodeEnv())
        process.env.TZ = this.config.tz || 'Europe/Paris'

        this.config.log.level = this.config.log && this.config.log.level ? this.config.log.level : 'warn'
    }

    /**
     * Add a plugin definition
     * 
     * @param {PluginDef} pluginDef Plugin definition
     * 
     * @returns {void}
     */
    addPlugin (pluginDef) {
        this.pm.addPlugin(pluginDef)
    }

    /**
     * Add an array of plugin definition
     * 
     * @param {Array<PluginDef>} pluginDefs Plugin definitions
     * 
     * @returns {void}
     */
    addPlugins (pluginDefs) {
        for (const pluginDef of pluginDefs) {
            this.pm.addPlugin(pluginDef)
        }
    }

    /**
     * Return a plugin instance
     * 
     * @param {string} name Plugin name
     * 
     * @returns {Plugin}
     */
    getPlugin (name) {
        return this.pm.getPlugin(name)
    }

    /**
     * Add a service definition
     * 
     * @param {ServiceDef} serviceDef Service definition
     * 
     * @returns {void}
     */
    addService (serviceDef) {
        this.container.addService(serviceDef)
    }

    /**
     * Add an array of service definition
     * 
     * @param {Array<ServiceDef>} serviceDefs Service definitions
     * 
     * @returns {void}
     */
    addServices (serviceDefs) {
        this.container.addServices(serviceDefs)
    }

    /**
     * Add a directory of service
     * 
     * @param {String} dirPath Directory path
     * @param {String} pattern Glob pattern
     * 
     * @returns {Promise<void>}
     */
    async addServiceDir (dirPath, pattern) {
        return this.container.addServiceDir(dirPath, pattern)
    }

    /**
     * Return a service instance
     * 
     * @param {string} name Service name
     * 
     * @returns {any}
     */
    getService (name) {
        return this.container.getService(name)
    }


    /**
     * Return the node env code
     *
     * @return {string}
     */
    getNodeEnv () {
        return process.env.NODE_ENV || 'production'
    }
    /**
     * Stop Midgar
     *
     * @return {Promise<void>}
     */
    stop () {
        /**
         * stop event.
         * @event stop
         */
        return this.emit('stop')
    }

    /**
     * Exit
     * Wait for the logger gracefull exit the process
     *
     * @return {Promise<void>}
     */
    async exit (code = 0) {
        // Stop app
        await this.stop()

        if (this.logger && !this._hasExitLogger) {
            this._hasExitLogger = true
            await this.logger.exit()
        }

        // exit process
        process.exit(code)
    }


    // exit handler
    exitHandler () {
        // flag exit to prevent multiple exit signals
        if (!this._exit) {
            this._exit = true
            // start exit sequence
            return this.exit()
        }
    }

    // Catch uncaught Exceptions
    uncaughtExceptionHandler (error) {
        if (this.logger && !this._hasExitLogger) {
            // log exception
            this.logger.error('App: Uncaught Exception :(')
            this.logger.error(error)
        } else {
            console.error(error)
        }
        return this.exit(1)
    }


    // Catch uncaught Exceptions
    uncaughtRejectionHandler (error) {
        if (this.logger && !this._hasExitLogger) {
            // log exception
            this.logger.error('App: Uncaught Rejection :(')
            this.logger.error(error)
        } else {
            console.error(error)
        }

        return this.exit(1)
    }

    /**
     * listen process exit signal signal and graceful exit
     * @private
     */
    _watchProcessExit () {
        // app is closing like process.exit()
        process.on('exit', (...args) => this.exitHandler(...args))
        // ctrl+c event
        process.on('SIGINT', (...args) => this.exitHandler(...args))
        // kill pid
        process.on('SIGUSR1', (...args) => this.exitHandler(...args))
        process.on('SIGUSR2', (...args) => this.exitHandler(...args))
        // uncaught exceptions
        process.on('uncaughtException', (...args) => this.uncaughtExceptionHandler(...args))
        process.on('unhandledRejection', (...args) => this.uncaughtRejectionHandler(...args))
    }

    /**
     * Log an error  message
     * @param  {...any} args
     */
    error (...args) {
        return this.logger.error(...args)
    }

    /**
     * Log a warning message
     * @param  {...any} args
     */
    warn (...args) {
        return this.logger.warn(...args)
    }

    /**
     * Log an info  message
     * @param  {...any} args
     */
    info (...args) {
        return this.logger.info(...args)
    }

    /**
     * Log a verbose message
     * @param  {...any} args
     */
    verbose (...args) {
        return this.logger.verbose(...args)
    }

    /**
     * Log a debug message
     * @param  {...any} args
     */
    debug (...args) {
        return this.logger.debug(...args)
    }

    /**
     * Log a silly message
     * @param  {...any} args
     */
    silly (...args) {
        return this.logger.silly(...args)
    }
}

module.exports = App
