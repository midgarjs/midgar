
import path from 'path'
import utils, { timer, asyncWriteFile } from '@midgar/utils'

const PACKAGE_JSON = 'package.json'
export const PLUGIN_CONFIG_FILE = 'plugin-config.js'
export const PLUGINS_CONFIG_FILE = 'plugins.json'

const notAddedPluginError = (name) => `Plugin ${name} is not in plugins config file !'`
/**
 * PluginMaganger class
 * Manage plugins
 * @todo: lot of asyn works :'(
 */
class PluginManager {
  constructor (mid) {
    /**
     * Midgar instance
     * @type {Midgar}
     */
    this.mid = mid

    /**
     * Plugins Object by name
     * @type {Object}
     */
    this.plugins = {}

    /**
     * local plugins directory path
     * @type {String}
     */
    this.pluginsPath = mid.config.plugin.dir

    /**
     * Define the default plugins dirs
     * it can be overite by the plugin config
     * @type {object}
     */
    this.pluginDirs = {}

    /**
     * Rewrite plugin object mapping
     * @type {Object}
     */
    this.rewritePlugins = {}

    /**
     * Rewrited plugin object mapping
     * @type {Object}
     */
    this.rewritedPlugins = {}

    /**
     * Rewrite plugin file mapping
     * @type {Object}
     */
    this.rewriteFile = {}

    // plugin dependencies object
    this._pluginDependencies = null
  }

  /**
   * Init plugin manager
   * Get the enabled plugins from the config and load them
   */
  async init () {
    // Import plugins config
    const { default: pluginsConfig } = await import(path.join(this.mid.configPath, PLUGINS_CONFIG_FILE))
    const pluginNames = Object.keys(pluginsConfig)

    // Remove disabled plugins
    const enabledPlugins = pluginNames.filter(name => {
      return this._isEnabledPlugin(name, pluginsConfig)
    })

    // Load plugins
    await this.loadPlugins(enabledPlugins, pluginsConfig)
  }

  /**
   * Load plugins config and package.json and create plugin instances
   *
   * @param {Array}  plugins       Array of plugin anabled plugins names
   * @param {Object} pluginsConfig Plugins config object (plugins.json)
   */
  async loadPlugins (plugins, pluginsConfig) {
    timer.start('midgar-plugin-load')
    this.mid.debug('start load plugins from ' + this.pluginsPath)

    // Get plugins config and package
    const pluginsConfigs = await this._loadPluginsConfigs(plugins, pluginsConfig)

    // Process plugin config
    await this._processPluginsConfig(pluginsConfigs)

    // Create plugin instances
    this.plugins = await this._createPluginInstances(pluginsConfigs)
    // Add rewrite plugin
    this._addRewritePluginInstances()

    const time = timer.getTime('midgar-plugin-load')
    this.mid.debug('plugins loaded in ' + time + ' ms')

    /**
     * afterLoadPlugins event.
     * @event @midgar/midgar:afterLoadPlugins
     */
    await this.mid.emit('@midgar/midgar:afterLoadPlugins')
  }

  /**
   * Import package.json and plugin-config.js for each plugin
   *
   * @param {Array} plugins Plugin name array
   * @param {Object} pluginsConfig Plugins config object (plugins.json)
   * @return {Object} Indexed by plugin name
   * @private
   */
  _loadPluginsConfigs (plugins, pluginsConfig) {
    return utils.asyncMap(plugins, async name => {
      let pluginPath = null

      // Check if plugin path is defined in plugins.json
      if (pluginsConfig[name].path !== undefined) {
        pluginPath = path.resolve(this.mid.configPath, pluginsConfig[name].path)
      }

      // check if plugin is in plugin path
      pluginPath = await this._getPluginPath(name, pluginPath)

      // Import plugin package.json and plugin-config.js
      const pkg = await import(path.resolve(pluginPath, PACKAGE_JSON))
      const mainFile = pkg.main ? pkg.main : 'index.js'
      const config = await this._importPluginConfig(path.parse(path.join(pluginPath, mainFile)).dir)

      if (name !== pkg.name) this.mid.warn('Plugin name in plugins config ( ' + name + ' ) is not equal to the package name ( ' + pkg.name + ' ) !')

      return {
        key: pkg.name,
        value: {
          package: pkg,
          config: config,
          path: pluginPath
        }
      }
    }, true)
  }

  /**
   * Check if plugin config have rewritePlugin entry
   * Add rewrite entries in rewritePlugins Object
   *
   * @param {Object} pluginsConfig Object object config and package indexed by plugin name
   * @private
   */
  _processPluginsConfig (pluginsConfig) {
    for (const name of Object.keys(pluginsConfig)) {
      const pluginConfig = pluginsConfig[name].config

      if (pluginConfig && pluginConfig.rewritePlugin) {
        this._processRewritePlugin(name, pluginConfig, pluginsConfig)
      }

      if (pluginConfig && pluginConfig.rewriteFile) {
        this._processRewriteFile(name, pluginsConfig[name])
      }
    }
  }

  /**
   * Check rewrite plugin and map entries
   * @private
   */
  _processRewritePlugin (name, pluginConfig, pluginsConfig) {
    // Check if plugin is configured to rewrite another plugin
    const rewritedPlugin = pluginConfig.rewritePlugin

    if (pluginsConfig[rewritedPlugin] === undefined) throw new Error('Unknow plugin ' + rewritedPlugin + ' !')

    // Warn if the plugin is not already rewrite
    if (this.rewritePlugins[rewritedPlugin] !== undefined) this.mid.warn('Plugin ' + name + ' rewite ' + rewritedPlugin + ' over ' + this.rewritePlugins[rewritedPlugin] + ' !')

    // Add rewrite plugin
    this.rewritedPlugins[rewritedPlugin] = name
    this.rewritePlugins[name] = rewritedPlugin
  }

  /**
   * Check rewrite plugin and map entries
   *
   * @param {String} name         Plugin name
   * @param {Object} pluginConfig Plugin configuration (plugin-config.js)
   * @private
   */
  _processRewriteFile (name, pluginConfig) {
    const pluginPath = pluginConfig.path
    pluginConfig = pluginConfig.config
    // List plugin directories
    for (const dirKey of Object.keys(pluginConfig.rewriteFile)) {
      // List plugins
      for (const rwName of Object.keys(pluginConfig.rewriteFile[dirKey])) {
        // List plugins
        for (const filePath of Object.keys(pluginConfig.rewriteFile[dirKey][rwName])) {
          const rewritFilePath = pluginConfig.rewriteFile[dirKey][rwName][filePath]
          this._processRewriteFileEntry(dirKey, name, rwName, filePath, rewritFilePath, pluginPath)
        }
      }
    }
  }

  /**
   * Map rewrite file entry
   *
   * @param {String} dirKey         Plugin directory key
   * @param {String} name           Rewriter plugin name
   * @param {String} rwName         Rewrite plugin name
   * @param {String} filePath       Rewrited file path
   * @param {String} rewritFilePath Rewrite file path
   * @param {String} pluginPath     Rewrite plugin path
   * @private
   */
  _processRewriteFileEntry (dirKey, name, rwName, filePath, rewritFilePath, pluginPath) {
    if (!this.rewriteFile[dirKey]) this.rewriteFile[dirKey] = {}
    if (!this.rewriteFile[dirKey][rwName]) this.rewriteFile[dirKey][rwName] = {}

    if (this.rewriteFile[dirKey][rwName][filePath] !== undefined) this.mid.warn('Plugin ' + name + ' rewite ' + rwName + ' ' + filePath + 'over ' + this.rewriteFile[dirKey][rwName][filePath] + ' !')
    this.rewriteFile[dirKey][rwName][filePath] = path.resolve(pluginPath, rewritFilePath)
  }

  /**
   * Create plugin instances
   * Check if a plugin need to be rewrite
   *
   * @param {Object} pluginsConfig Object object config and package indexed by plugin name
   * @private
   */
  _createPluginInstances (pluginsConfig) {
    // Load plugins
    return utils.asyncMap(pluginsConfig, async (pluginConfig, name) => {
      let pkg = pluginConfig.package
      let mainFile = pkg.main ? pkg.main : 'index.js'

      const pluginPath = path.parse(path.join(pluginConfig.path, mainFile)).dir
      let importPath = pluginPath
      // Skip rewrite plugin
      if (this.rewritePlugins[name]) return

      // ceck if plugin is rewrited
      if (this.rewritedPlugins[name]) {
        // Config of plugin who rewrite
        const reweriteConfig = pluginsConfig[this.rewritedPlugins[name]]
        pkg = reweriteConfig.package
        mainFile = pkg.main ? pkg.main : 'index.js'
        importPath = path.parse(path.join(reweriteConfig.path, mainFile)).dir
      }

      return { key: name, value: this._createPluginInstance(name, pluginPath, importPath, pkg, pluginConfig.config) }
    }, true)
  }

  /**
   * Add rewrite plugin instance to plugins object
   * @private
   */
  _addRewritePluginInstances () {
    for (const name in this.rewritePlugins) {
      this.plugins[name] = this.plugins[this.rewritePlugins[name]]
    }
  }

  /**
   * Import plugin file, create plugin instance and init plugin
   *
   * @param {String} name       Plugin name
   * @param {String} pluginPath Plugin path
   * @param {Object} pkg        Plugin package.json
   * @param {Object} config     Plugin config from plugin-config.js
   * @return {Plugin}
   * @private
   */
  async _createPluginInstance (name, pluginPath, importPath, pkg, config) {
    // Import plugin main file
    const { default: Class } = await import(importPath)

    // Create plugin intance
    const plugin = new Class(this.mid, { name, path: pluginPath, package: pkg, config })

    // Init plugin
    await plugin.init()

    /**
     * afterInit plugin event.
     * @event ${pluginName}:afterInit
     */
    await this.mid.emit(name + ':afterInit')

    return plugin
  }

  /**
   * Import plugin-config.js file if exist
   *
   * @param {String} pluginPath Plugin path
   * @return {Object}
   * @private
   */
  async _importPluginConfig (pluginPath) {
    try {
      const configPath = path.resolve(pluginPath, PLUGIN_CONFIG_FILE)
      if (!await utils.asyncFileExists(configPath)) return {}
      const { default: config } = await import(configPath)
      return config
    } catch (error) {
      return {}
    }
  }

  /**
   * Add a plugin in the plugins.json config file
   * Return true if the plugin was added or false
   *
   * @param {String} name Plugin name
   * @return {Boolean}
   */
  async addPlugin (name) {
    const { default: plugins } = await import(path.join(this.mid.configPath, PLUGINS_CONFIG_FILE))

    if (plugins[name] === undefined) {
      plugins[name] = true
      await asyncWriteFile(path.join(this.mid.configPath, PLUGINS_CONFIG_FILE), JSON.stringify(plugins))
      return true
    }

    return false
  }

  /**
   * Remove a plugin from the plugins.json config file
   * Return true if the plugin was removed or false
   *
   * @param {String} name Plugin name
   * @return {Boolean}
   */
  async removePlugin (name) {
    const { default: plugins } = await import(path.join(this.mid.configPath, PLUGINS_CONFIG_FILE))

    if (plugins[name] === undefined) {
      this.mid.warn(notAddedPluginError(name))
    } else {
      delete plugins[name]
      await asyncWriteFile(path.join(this.mid.configPath, PLUGINS_CONFIG_FILE), JSON.stringify(plugins))
      return true
    }

    return false
  }

  /**
   * Check if the plugin is enabled
   *
   * @param {String} name    Plugin name
   * @param {Object} plugins Plugins config (plugins.json)
   * @return {Boolean}
   * @private
   */
  _isEnabledPlugin (name, plugins) {
    return (typeof plugins[name] === 'boolean' && plugins[name]) ||
     (plugins[name].enabled !== undefined && plugins[name].enabled)
  }

  /**
   * Enable a plugin in the plugins.json config file
   * Return true if the plugin was enabled or false
   *
   * @param {String} name Plugin name
   * @return {Boolean}
   */
  async enablePlugin (name) {
    const { default: plugins } = await import(path.join(this.mid.configPath, PLUGINS_CONFIG_FILE))

    if (plugins[name] === undefined) {
      this.mid.warn(notAddedPluginError(name))
    } else if (!this._isEnabledPlugin(name, plugins)) {
      if (typeof plugins[name] === 'boolean') {
        plugins[name] = true
      } else {
        plugins[name].enabled = true
      }

      await asyncWriteFile(path.join(this.mid.configPath, PLUGINS_CONFIG_FILE), JSON.stringify(plugins))
      return true
    } else {
      this.mid.warn('Plugin ' + name + ' is already enabled !')
    }

    return false
  }

  /**
   * Disable a plugin in the plugins.json config file
   * Return true if the plugin was enabled or false
   *
   * @param {String} name Plugin name
   * @return {Boolean}
   */
  async disablePlugin (name) {
    const { default: plugins } = await import(path.join(this.mid.configPath, PLUGINS_CONFIG_FILE))

    if (plugins[name] === undefined) {
      this.mid.warn(notAddedPluginError(name))
    } else if (this._isEnabledPlugin(name, plugins)) {
      if (typeof plugins[name] === 'boolean') {
        plugins[name] = false
      } else {
        plugins[name].enabled = false
      }

      await asyncWriteFile(path.join(this.mid.configPath, PLUGINS_CONFIG_FILE), JSON.stringify(plugins))
      return true
    } else {
      this.mid.warn('Plugin ' + name + ' is already disabled !')
    }

    return false
  }

  /**
   * Return a plugin path
   *
   * @param {string} name       Plugin name
   * @param {string} pluginPath Optional path for local plugin
   * @returns {string}
   * @private
   */
  async _getPluginPath (name, pluginPath = null) {
    try {
      if (pluginPath) {
        pluginPath = path.join(pluginPath, PACKAGE_JSON)
      } else {
        pluginPath = path.join(name, PACKAGE_JSON)
      }
      const packagePath = await utils.asyncRequireResolve(pluginPath)

      return path.dirname(packagePath)
    } catch (error) {
      try {
        const packagePath = await utils.asyncRequireResolve(path.join(this.pluginsPath, name, PACKAGE_JSON))
        return path.dirname(packagePath)
      } catch (_error) {
        throw new Error('Plugin ' + name + ' not found !')
      }
    }
  }

  /**
   * Return a plugin instance by name
   *
   * @param {String} name Plugin name
   * @return {Plugin}
   */
  getPlugin (name) {
    return this.plugins[name]
  }

  /**
   * Add a plugin directory
   *
   * @param {String} key         Directory key
   * @param {String} defaultPath Default path
   */
  addPluginDir (key, defaultPath) {
    this.pluginDirs[key] = defaultPath
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
      this.mid.warn('Unknow plugin dir ' + dir)
    }

    return utils.asyncMap(this.plugins, async (plugin, name) => {
      if (!this.pluginDirs[dir] && !plugin.dirs[dir]) return null

      // get the routes path of the plugin
      const dirPath = path.join(plugin.path, plugin.dirs[dir] ? plugin.dirs[dir] : this.pluginDirs[dir])
      // check if the dir exist
      const exists = await utils.asyncFileExists(dirPath)
      if (exists) { return { plugin: name, path: dirPath } } else { return null }
    })
  }

  /**
   * Import files inside a directory of each plugins
   *
   * @param {String}  dirkey   Plugin dir name
   * @param {RegExp}  regExp    Use to filter by filname
   * @param {Boolean} recursive Reacursive or not, it true by default
   *
   * @return {Array}
   */
  async importDir (dirkey, regExp = null, recursive = true) {
    if (!this.pluginDirs[dirkey]) this.mid.warn('Unknow plugin dir ' + dirkey)

    const files = []
    // List plugins
    await utils.asyncMap(this.plugins, async (plugin) => {
      if (!this.pluginDirs[dirkey] && !plugin.dirs[dirkey]) return // skip

      // Get the plugin dir path
      const dirPath = plugin.getDirPath(dirkey)

      // check if the dir exist
      const exists = await utils.asyncFileExists(dirPath)
      if (exists) {
        // Read all files inside the direactory
        const pluginFiles = await this._importPluginFiles(plugin.name, dirkey, dirPath, '.', regExp, recursive)
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
   * @private
   */
  async _importPluginFiles (plugin, dirkey, basePath, dirPath, regExp = null, recursive = false) {
    let result = []

    // Read all file in the dir
    const files = await utils.asyncReaddir(path.join(basePath, dirPath))

    // List files
    for (let i = 0; i < files.length; i++) {
      // file name
      const name = files[i]

      // Check filename with regex
      if (regExp !== null && !name.match(regExp)) {
        // if regex check fail skip file
        continue
      }

      // Check if it a directory
      const filePath = path.join(basePath, dirPath, name)
      const fileStat = await utils.asyncStat(filePath)

      if (!fileStat.isDirectory()) {
        try {
          let importPath = filePath
          const relativePath = path.join(dirPath, name)
          if (this.rewriteFile[dirkey] !== undefined && this.rewriteFile[dirkey][plugin] !== undefined && this.rewriteFile[dirkey][plugin][relativePath] !== undefined) {
            importPath = this.rewriteFile[dirkey][plugin][relativePath]
          }

          const { default: defaultExport } = await import(importPath)
          result.push({ path: filePath, export: defaultExport, plugin, relativePath })
        } catch (error) {
          console.log(error)
        }
      // if it a directory and recursive read files inside
      } else if (recursive) {
        const childFiles = await this._importPluginFiles(plugin, dirkey, basePath, path.join(dirPath, name), regExp, recursive)
        result = result.concat(childFiles)
      }
    }

    return result
  }

  /**
   * Return an array of plugin names sorted by dependencies
   *
   * @param {Array} plugins Plugin name, if is not set use all plugin register
   * @returns {Array}
   */
  getSortedPlugins (plugins = null) {
    if (plugins == null) {
      plugins = Object.keys(this.plugins)
    }

    // Get plugins dependencies
    const pluginsDependencies = this._getPluginsDependencies()
    // Clone dependencies object
    const dependencies = this._cloneDep(pluginsDependencies)

    // Clone plugins array
    plugins = Array.from(plugins)

    // Result array
    const sortedPlugins = []

    // stop if no plugin is added in the result array
    // or there are no more plugins
    while (plugins.length) {
      this._sortPlugins(plugins, sortedPlugins, dependencies)
    }

    return sortedPlugins
  }

  /**
   * @param {*} plugins
   * @param {*} sortedPlugins
   * @param {*} dependencies
   * @private
   */
  _sortPlugins (plugins, sortedPlugins, dependencies) {
    // list plugins
    for (let i = 0; i < plugins.length; i++) {
      const pluginName = plugins[i]

      // Get plugin dependencies
      const pluginDependencies = dependencies[pluginName]

      // If plugin have dependencies
      if (pluginDependencies && pluginDependencies.length) {
        // If result is empty continue while his dependencies is added to sortedPlugins
        if (!sortedPlugins.length) continue

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

  /**
   * Clone dependency Object
   *
   * @param {Object} deps
   * @return {Object}
   * @private
   */
  _cloneDep (deps) {
    const o = {}
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
   * @return {Boolean}
   * @private
   */
  _haveAllDep (sortedPlugins, pluginDependencies) {
    let haveAllDep = true
    for (let i = 0; i < pluginDependencies.length; i++) {
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
   * @private
   */
  _getPluginsDependencies () {
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
   * @returns {Array}
   * @private
   */
  _getPluginDependencies (plugin) {
    const pluginDependencies = []

    // Get plugin dependencies from package.json
    const pkg = plugin.package

    // If plugin have dependencies
    if (pkg.dependencies) {
      // List dependencies in object pkg.dependencies
      for (const depName in pkg.dependencies) {
        // If the dependency is a register midgar plugin
        if (this.plugins[depName] !== undefined) {
          pluginDependencies.push(depName)
        }
      }
    }

    return pluginDependencies
  }
}

export default PluginManager
