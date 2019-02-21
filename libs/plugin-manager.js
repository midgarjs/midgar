const path = require('path')

const utils = require('@midgar/utils')
const PM = require ('@midgar/plugin-manager')

const Plugin = require ('../plugin')

/**
 * PluginMaganger class
 * Override the Plugin manager to get log
 * and chack plugin type
 */
class PluginManager extends PM {
  /**
   * Construct
   * @param {Migar} midgar Midgar instance
   */
  constructor (midgar) {
    const options = {}
    options.pluginsPath = midgar.config.plugin.dir
    super(options)

    /**
     * Midgar instance
     * @type {Midgar}
     */
    this.midgar = midgar

    /**
     * Define the default plugins dirs
     * it can be overite by the plugin config
     * @type {object}
     */
    this.pluginDirs = {
      //config files
      config: 'config',
    }

    //observe events
    this._observeEvents()
  }

  /**
   * Init plugin manager
   * Get the plugins to load from the config
   * and load them
   */
  async init() {
    //load plugins config file
    const plugins = await this.midgar.config.loadConfig(path.join(this.midgar.configPath, 'plugins'))
    await this.loadPlugins(plugins)
  }


  /**
   * Create the plugin instance
   * 
   * @param {constructor} Class        Plugin constructor
   * @param {Object}      options      Plugin options
   * @param {sting}       options.name Name
   * 
   * @private
   */
  async _createPluginInstance(Class, options) {

    //if (Class.prototype instanceof Plugin) {
      return new Class(this.midgar, options)
    /*} else {
      throw new Error ('Invalid plugin ' + options.name + ' not valid class prototype')
    }*/
  }

  /**
   * Observe plugin manager event to bind them
   * @private
   */
  _observeEvents() {
    //observe start plugin load to get the load time
    this.on('loadPluginsStart', plugins => {
      utils.timer.start('midgar-plugin-load')
      this.midgar.debug('start load plugins from ' + this.options.pluginsPath)
    })

    //observe end plugin load to get the load time
    this.on('loadPluginsEnd', () => {
      const time = utils.timer.getTime('midgar-plugin-load')
      this.midgar.debug('plugins loaded in ' + time[0] + 's, ' +  time[1] + 'ms')
    })

    //bind logger
    this.on('debug', msg => {
      this.midgar.debug(msg)
    })

    this.on('error', error => {
      this.midgar.error(error)
    })

    this.on('warn', msg => {
      this.midgar.warn(msg)
    })
  }
}

module.exports = PluginManager
