const path = require('path')
const Emittery = require('emittery')
const {timer, asyncWriteFile} = require('@midgar/utils')
const utils = require('@midgar/utils')
const Dependency = require('./dependency')

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
    this.pluginDirs = {}
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
    timer.start('midgar-plugin-load')
    this.midgar.debug('start load plugins from ' + this.options.pluginsPath)

    //list plugins
    this.plugins = await utils.asyncMap(pluginsPath, async pluginPath => {
        //check if plugin is in plugin path
        pluginPath = await this._getPluginPath(pluginPath)
        const pkg = await this._getPluginPackage(pluginPath)
        return {key: pkg.name, value: this.loadPlugin(pkg.name, pluginPath, pkg)}
      }, true)
      
      //after Load callback
      await this.emit('midgar:afterLoadPlugins')

      const time = timer.getTime('midgar-plugin-load')
      this.midgar.debug('plugins loaded in ' + time + ' ms')
  }

  /**
   * Add a plugin in the plugins.js cinfig file file
   * @param {*} plugin 
   */
  async addPlugin(plugin) {
    const plugins = await this.midgar.config.loadConfig(path.join(this.midgar.configPath, 'plugins'))

    if (plugins.indexOf(plugin) == -1) {
      plugins.push(plugin)
      await asyncWriteFile(path.join(this.midgar.configPath, 'plugins.js'), 'module.exports = ' + JSON.stringify(plugins))
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
    return await utils.asyncRequire(path.resolve(pluginPath, 'package.json'))
  }

  /**
   *
   * @param {*} name
   * @param {*} pluginPath
   */
  async loadPlugin (name, pluginPath, pkg) {
    const mainFile = pkg.main ? pkg.main : 'index.js'
    //require plugin class
    const Class = await utils.asyncRequire(path.join(pluginPath, mainFile))
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
   * 
   * @param dir plugin dir key
   * 
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
   * Read files inside a directory of each plugins
   * 
   * @param {String}  dirName   Plugin dir name
   * @param {RegExp}  regExp    Use to filter by filname
   * @param {Boolean} recursive Reacursive or not, it true by default
   * 
   * @return {Object}
   */
  async requireFiles (dirName, regExp = null, recursive = true) {
    if (!this.pluginDirs[dirName]) {
      this.emit('warn', 'Unknow plugin dir ' + dirName)
    }

    const files = []
    // List plugins
    await utils.asyncMap(this.plugins, async (plugin) => {

      if (!this.pluginDirs[dirName] && !plugin.dirs[dirName]) return //skip

      // Get the plugin dir path
      const dirPath = plugin.getDirPath(dirName)

      // check if the dir exist
      const exists = await utils.asyncFileExists(dirPath)
      if (exists){
        // Read all files inside the direactory
        const pluginFiles = await this._requirePluginFiles(plugin.name, dirPath, '.', regExp, recursive)
        files.push(...pluginFiles)
      }
    })

    return files
  }

  /**
   * Require all files inside a directory of a plugin
   * 
   * @param {Plugin} plugin Plugin instance
   * @param {String} basePath Absolute path of the direactory base directory inside the plugin
   * @param {String} dirPath Relative path of the current directory to read
   * 
   * 
   */
  async _requirePluginFiles (plugin, basePath, dirPath, regExp = null, recursive = false) {
    let result = []

    // Read all file in the dir
    const files = await utils.asyncReaddir(path.join(basePath, dirPath))

    // List files
    for (let i = 0;i < files.length;i++) {
      // file name
      const name = files[i]

      // Check filename with regex
      if (regExp !== null) {
        let result = name.match(regExp)
        // if regex check fail skip file
        if (!result) {
          continue
        }
      }

      // Check if it a directory
      const filePath = path.join(basePath, dirPath, name)
      const fileStat = await utils.asyncStat(filePath)

      if (!fileStat.isDirectory()) {
        // Only import files that we can `require`
        const ext = path.extname(name)
        if (require.extensions[ext]) {
          try {
            const requireFile = await utils.asyncRequire(filePath)
            result.push({path: filePath, export: requireFile, plugin, relativePath: path.join(dirPath, name)})
          } catch(error) {
             console.log(error)
          }
        }
      // if it a directory and recursive read files inside
      } else if (recursive) {
        const childFiles = await this._requirePluginFiles(plugin, basePath, path.join(dirPath, name), regExp, recursive)
        result = result.concat(childFiles)
      }
    }

    return result
  }

  async getDependenciesTree() {
    const pluginToProcess = Object.keys(this.plugins)
    const pluginDependencies = await this._getPluginsDependencies()
    const dependency = new Dependency(pluginToProcess, pluginDependencies)

    return dependency.getTree()
  }

  /**
   * Return an array of plugin names sorted by dependencies
   * 
   * @param {Array} plugins Plugin name, if is not set use all plugin register
   * 
   * @returns {Array}
   */
  getSortedPlugins(plugins = null) {
    if (plugins == null) {
      plugins = Object.keys(this.plugins)
    }

    // Get plugins dependencies
    const pluginDependencies = this._getPluginsDependencies()
    // Clone dependencies object
    const dependencies = this._cloneDep(pluginDependencies)
    
    // Clone plugins array
    plugins = Array.from(plugins)

    // Result array
    let sortedPlugins = []

    //stop if no plugin is added in the result array
    //or there are no more plugins
    while(plugins.length) {
      //list plugins
      for (let i = 0;i < plugins.length;i++) {
        const pluginName = plugins[i]

        // Get plugin dependencies
        const pluginDependencies = dependencies[pluginName]

        // If plugin have dependencies
        if (pluginDependencies && pluginDependencies.length) {

          // If result is empty continue while his dependencies is added to sortedPlugins
          if (!sortedPlugins.length) {
            continue
          }

          if (this._haveAllDep(sortedPlugins, pluginDependencies)) {
            sortedPlugins.push(pluginName)          
            plugins.splice(plugins.indexOf(pluginName), 1)
            i--
          }
        } else {
          // if no dependcies add the plugin
          sortedPlugins.push(pluginName)
          plugins.splice(plugins.indexOf(pluginName), 1)
          i--
        }
      }
    }

    return sortedPlugins
  }

  /**
   * Clone dependency Object
   * 
   * @param {Object} deps 
   * 
   * @return {Object}
   */
  _cloneDep(deps) {
    let o = {}
    for (const k in deps) {
      o[k] = Array.from(deps[k])
    }
    return o
  }

  /**
   * Check if all dependencues in pluginDependencies are in the array sortedPlugins
   * 
   * @param {Array} sortedPlugins      Plugin names 
   * @param {Array} pluginDependencies Plugin dependencies names
   * 
   * @return {Boolean}
   */
  _haveAllDep(sortedPlugins, pluginDependencies) {
    let haveAllDep = true
    for (let i = 0;i < pluginDependencies.length;i++) {
      if (sortedPlugins.indexOf(pluginDependencies[i]) === -1) {
        haveAllDep = false
      }
    }

    return haveAllDep
  }

  /**
   * return an object with plugins dependencies
   * 
   * @return {Object}
   */
  _getPluginsDependencies() {
    if (this._pluginDependencies == null) {
      this._pluginDependencies = {}

      // List all register plugin
      for (const name in this.plugins) {
        const plugin = this.plugins[name]
        // Add plugin dependencies
        this._pluginDependencies[name] = this._getPluginDependencies(plugin)
      }
    }

    return this._pluginDependencies
  }

  /**
   * Return get all depencies of plugin and return midgar plugin name
   * 
   * @param {Plugin} plugin Plugin instance
   * 
   * @returns {Array}
   */
  _getPluginDependencies(plugin) {
    const pluginDependencies = []

    // Get plugin dependencies from package.json
    const pkg = plugin.package

    // If plugin have dependencies
    if (pkg.dependencies) {

      // List dependencies in object pkg.dependencies
      for (const depName in pkg.dependencies) {
        // If the dependency is a register midgar plugin
        if (this.plugins[depName] != undefined) {
          pluginDependencies.push(depName)
        }
      }
    }

    return pluginDependencies
  }
}

module.exports = PluginManager
