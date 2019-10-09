const path = require('path')
const Emittery = require('emittery')
const {timer, asyncWriteFile} = require('@midgar/utils')
const utils = require('@midgar/utils')
const Dependency = require('./dependency')

// const Plugin = require ('../plugin')
// const addIncludePath = require('include-path')

/**
 * PluginMaganger class
 * Manage plugins
 * @todo: lot of asyn works :'(
 */
class PluginManager extends Emittery {
  constructor (midgar) {
    super()

    const options = {}
    this.options = Object.assign({
    }, options)

    /**
     * Midgar instance
     * @type {Midgar}
     */
    this.midgar = midgar

    this.plugins = {}

    this.pluginsPath = midgar.config.plugin.dir

    //plugin dirs object
    this.pluginDirs = {}

    //plugin dependencies object
    this._pluginDependencies = null

    /**
     * Define the default plugins dirs
     * it can be overite by the plugin config
     * @type {object}
     */
    this.pluginDirs = {
      //config files
      config: 'config',
    }


    // Observe events
    this._observeEvents()

    //addIncludePath(this.options.pluginsPath)
  }

  /**
   * Init plugin manager
   * Get the plugins to load from the config
   * and load them
   */
  async init() {
    //load plugins config file
    const pluginsPath = await this.midgar.config.loadConfig(path.join(this.midgar.configPath, 'plugins'))
    await this.loadPlugins(pluginsPath)
  }

  /**
   * Load plugins in the plugin array
   * and in the pluginsPath directory
   *
   * @param {Array} plugins array of plugin names
   * @param {String} pluginsPath plugins directory
   */
  async loadPlugins (pluginsPath) {
    this.emit('loadPluginsStart', pluginsPath)
    //list plugins
    this.plugins = await utils.asyncMap(pluginsPath, async pluginPath => {
        //check if plugin is in plugin path
        pluginPath = await this._getPluginPath(pluginPath)
        const pkg = await this._getPluginPackage(pluginPath)

        return {key: pkg.name, value: this.loadPlugin(pkg.name, pluginPath, pkg)}
      }, true)
      
      //after Load callback
      await this.emit('afterLoadPlugins')
      await this.emit('loadPluginsEnd')
  }

  /**
   * Add a plugin in the plugins.js cinfig file file
   * @param {*} plugin 
   */
  async addPlugin(plugin) {
    const plugins = await this.midgar.config.loadConfig(path.join(this.midgar.configPath, 'plugins'))

    if (plugins.indexOf(plugin) == -1) {
      plugins.push(plugin)
      try {
        await asyncWriteFile(path.join(this.midgar.configPath, 'plugins.js'), 'module.exports = ' + JSON.stringify(plugins))
      } catch (error) {
        throw error
      }
    }
  }

  /**
   * Return a plugin path
   * 
   * @param {string} name
   * 
   * @returns {string} 
   */
  async _getPluginPath(pluginPath) {
    try {
      let packagePath = await utils.asyncRequireResolve(path.join(pluginPath, 'package.json'))
      return path.dirname(packagePath)
    } catch (error) {
      try {
        let packagePath = await utils.asyncRequireResolve(path.join(this.pluginsPath, pluginPath, 'package.json'))
        return path.dirname(packagePath)
      } catch (error) {
        throw new Error('Plugin ' + pluginPath + ' not found !');
      }
    }
  }

  /**
   * Load plugin.json file
   * @param {*} name 
   */
  async _getPluginPackage(pluginPath) {
    return await utils.asyncRequire(path.join(pluginPath, 'package.json'))
  }

  /**
   *
   * @param {*} name
   * @param {*} pluginPath
   */
  async loadPlugin (name, pluginPath, pkg) {
    //require plugin class
    const Class = await utils.asyncRequire(path.join(pluginPath, pkg.main))
    const plugin = await this._createPluginInstance(Class, {name, path: pluginPath, package: pkg})
    await plugin.init()
   
    return plugin
  }

  getPlugin(name) {
    return this.plugins[name]
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
    return new Class(this.midgar, options)
  }

  /**
   * Return an array of object contain
   * the plugin and the dir found
   * @param dir plugin dir key
   * @return {Array}
   */
  async getDirs (dir) {
    if (!this.pluginDirs[dir]) {
      this.emit('warn', 'Unknow plugin dir ' + dir)
    }

    return utils.asyncMap(this.plugins, async (plugin, name) => {
      if (!this.pluginDirs[dir] && !plugin.dirs[dir]) return null

      //get the routes path of the plugin
      const dirPath = path.join(plugin.path, plugin.dirs[dir] ? plugin.dirs[dir] : this.pluginDirs[dir])
      //check if the dir exist
      const exists = await utils.asyncFileExists(dirPath)
        if (exists)
          return {plugin: name, path: dirPath}
        else
          return null
    })
  }

  /**
   * read plugins files
   * return then in an object indexed by file path
   *
   * @param dir
   */
  async readFiles (...args) {
    const files = await this.readPluginsFiles(...args)

    let _files = []
    for (const name in files) {
      _files = _files.concat(files[name])
    }
    
    return _files
  }

  async readPluginsFiles (dirName, regExp = null, recursive = false) {
    if (!this.pluginDirs[dirName]) {
      this.emit('warn', 'Unknow plugin dir ' + dirName)
    }

    return utils.asyncMap(this.plugins, async (plugin, name) => {

      if (!this.pluginDirs[dirName] && !plugin.dirs[dir]) return //skip
      //get the plugin dir path
      const dirPath = plugin.getDirPath(dirName)

      const exists = await utils.asyncFileExists(dirPath)
      if (exists){
        const files = await this._readPluginFiles(plugin.name, dirPath, '.', regExp, recursive)
        return {key: name, value: files}
      } else {
        return //skip
      }
    }, true)
  }

  /**
   */
  async _readPluginFiles (plugin, basePath, dirPath, regExp = null, recursive = false) {
    let result = []

    const files = await utils.asyncReaddir(path.join(basePath, dirPath))

    //list files
    for (let key in files) {
      const name = files[key]
      //check filename with regex
      if (regExp !== null) {
        let result = name.match(regExp)
        //if regex check fail skip file
        if (!result) {
          continue
        }
      }

      const filePath = path.join(basePath, dirPath, name)
      const fileStat = await utils.asyncStat(filePath)

      if (!fileStat.isDirectory()) {
        // only import files that we can `require`
        const ext = path.extname(name)
        if (require.extensions[ext]) {
          try {
            const requireFile = await utils.asyncRequire(filePath)
            result.push({path: filePath, export: requireFile, plugin, relativePath: path.join(dirPath, name)})
          } catch(error) {
             console.log(error)
          }
        }
      } else if (recursive) {
        result = result.concat(await this._readPluginFiles(plugin, basePath, path.join(dirPath, name), regExp, recursive))
      }
    }

    return result.length ? result : null
  }

  async getDependenciesTree() {
    const pluginToProcess = Object.keys(this.plugins)
    const pluginDependencies = await this._getPluginsDependencies()
    const dependency = new Dependency(pluginToProcess, pluginDependencies)

    return dependency.getTree()
  }

  /**
   * Return an array of plugin name sort by dependencies
   */
  async getDependenciesOrder(plugins = null) {
    if (plugins == null) {
      plugins = Object.keys(this.plugins)
    }
    //get plugins dependencies
    const pluginDependencies = await this._getPluginsDependencies()

    //get dependencies order
    const dependency = new Dependency(plugins, pluginDependencies)
    return dependency.getOrder()
  }

  /**
   * return an object with plugins dependencies
   */
  async _getPluginsDependencies() {
    if (this._pluginDependencies == null) {
      //list plugins
      this._pluginDependencies = await utils.asyncMap(this.plugins, (plugin, name) => {
        //get plugin dependencies
        return {key: name, value: this._getPluginDependencies(plugin)}
      }, true)
    }
    return this._pluginDependencies
  }

  /**
   * Return an array of plugin dependencies
   * 
   * @param {sting} plugin plugin name
   */
  async _getPluginDependencies(plugin) {
    //result array
    const pluginDependencies = []
    //get plugin dependencies from package.json
    const pkg = await plugin.getPackage()

    //if plugin have dependencies
    if (pkg.dependencies) {
      //list dependencies
      for (const depName in pkg.dependencies) {
        //if the dependency is a plugin
        if (this.plugins[depName] != undefined) {
          pluginDependencies.push(depName)
        }
      }
    }

    return pluginDependencies
  }


  /**
   * Observe plugin manager event to bind them
   * @private
   */
  _observeEvents() {
    //observe start plugin load to get the load time
    this.on('loadPluginsStart', plugins => {
      timer.start('midgar-plugin-load')
      this.midgar.debug('start load plugins from ' + this.options.pluginsPath)
    })

    //observe end plugin load to get the load time
    this.on('loadPluginsEnd', () => {
      const time = timer.getTime('midgar-plugin-load')
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
