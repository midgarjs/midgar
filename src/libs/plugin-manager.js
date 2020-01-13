
import path from 'path'
import utils, { asyncWriteFile } from '@midgar/utils'

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
     * Plugins Dictionary
     * @type {Object}
     */
    this.plugins = {}

    /**
     * local plugins directory path
     * @type {String}
     */
    this.localPath = mid.config.pluginsLocalPath

    /**
     * Module types dictionary
     * @type {object}
     */
    this.moduleTypes = {}

    /**
     * Rewrite plugin dictionary
     * @type {Object}
     */
    this.rewritePlugins = {}

    /**
     * Rewrited plugin dictionary
     * @type {Object}
     */
    this.rewritedPlugins = {}

    /**
     * Rewrite modules
     * @type {Object}
     */
    this.rewriteModules = {}

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
    // Get plugins config and package
    const pluginsConfigs = await this._loadPluginsConfigs(plugins, pluginsConfig)

    // Process plugin config
    await this._processPluginsConfig(pluginsConfigs)

    // Create plugin instances
    this.plugins = await this._createPluginInstances(pluginsConfigs)
    // Add rewrite plugin
    this._addRewritePluginInstances()

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
      let packagePath = name
      let local = false

      // Check if plugin path is defined in plugins.json
      if (typeof pluginsConfig[name] !== 'boolean' && pluginsConfig[name].path !== undefined) {
        // Set path relative to Midgar config directory
        packagePath = path.joint(this.configPath, pluginsConfig[name].path)
        local = true
      }

      if (!local && pluginsConfig[name].local) {
        local = true
        packagePath = path.join(this.localPath, name)
      }
      let pkg
      const pkgPath = path.join(packagePath, PACKAGE_JSON)
      try {
        // Import plugin package.json and plugin-config.js
        pkg = await import(pkgPath)
      } catch (error) {
        if (error.code && error.code === 'MODULE_NOT_FOUND') throw new Error(`@midgar/midgar: package.json not found for plugin ${name} at ${pkgPath} ) !`)
        throw error
      }

      const mainFile = pkg.main ? pkg.main : 'index.js'

      // Set main file directory as plugin directory
      const pluginPath = path.parse(path.join(packagePath, mainFile)).dir

      const config = await this._importPluginConfig(pluginPath)

      if (name !== pkg.name) this.mid.warn(`@midgar/midgar: Plugin name in plugins config ( ${name} ) is not equal to the package name ( ${pkg.name} ) !`)

      return {
        key: pkg.name,
        value: {
          package: pkg,
          config: config,
          packagePath: packagePath,
          pluginPath: pluginPath
        }
      }
    }, true)
  }

  /**
   * Check if plugin config have rewritePlugin entry
   * Add rewrite entries in rewritePlugins Object
   *
   * @param {Object} pluginsConfigs Dictionay of plugin config and package.json
   * @private
   */
  _processPluginsConfig (pluginsConfigs) {
    for (const name of Object.keys(pluginsConfigs)) {
      const pluginConfig = pluginsConfigs[name].config
      if (pluginConfig && pluginConfig.rewrite) {
        if (pluginConfig.rewrite.plugin) {
          if (typeof pluginConfig.rewrite.plugin !== 'string') throw new TypeError(`@midgar/midgar: Invalid rewrite plugin type in config of ${name} plugin !`)
          this._processRewritePlugin(name, pluginsConfigs)
        }

        if (pluginConfig.rewrite.modules) {
          this._processRewriteModules(name, pluginsConfigs[name])
        }
      }
    }
  }

  /**
   * Check rewrite plugin and map entries
   * @private
   */
  _processRewritePlugin (name, pluginsConfigs) {
    // Check if plugin is configured to rewrite another plugin
    const rewritedPlugin = pluginsConfigs[name].config.rewrite.plugin

    if (pluginsConfigs[rewritedPlugin] === undefined) throw new Error(`@midgar/midgar: Unknow plugin ${rewritedPlugin} !`)

    // Warn if the plugin is not already rewrite
    if (this.rewritePlugins[rewritedPlugin] !== undefined) this.mid.warn(`@midgar/midgar: Plugin ${name} rewite ${rewritedPlugin} over ${this.rewritePlugins[rewritedPlugin]} !`)

    // Add rewrite plugin
    this.rewritedPlugins[rewritedPlugin] = name
    this.rewritePlugins[name] = rewritedPlugin
  }

  /**
   * Check rewrite plugin and map entries
   *
   * @param {String} name         Plugin name
   * @param {Object} pluginConfigs plugin config and package.json
   * @private
   */
  _processRewriteModules (name, pluginConfigs) {
    const pluginPath = pluginConfigs.pluginPath
    const pluginConfig = pluginConfigs.config
    // List plugin directories
    for (const dirKey of Object.keys(pluginConfig.rewrite.modules)) {
      // List plugins
      for (const rwName of Object.keys(pluginConfig.rewrite.modules[dirKey])) {
        // List plugins
        for (const filePath of Object.keys(pluginConfig.rewrite.modules[dirKey][rwName])) {
          const rewritFilePath = pluginConfig.rewrite.modules[dirKey][rwName][filePath]
          this._processrewriteModulesEntry(dirKey, name, rwName, filePath, rewritFilePath, pluginPath)
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
  _processrewriteModulesEntry (dirKey, name, rwName, filePath, rewritFilePath, pluginPath) {
    if (!this.rewriteModules[dirKey]) this.rewriteModules[dirKey] = {}
    if (!this.rewriteModules[dirKey][rwName]) this.rewriteModules[dirKey][rwName] = {}

    if (this.rewriteModules[dirKey][rwName][filePath] !== undefined) this.mid.warn('Plugin ' + name + ' rewite ' + rwName + ' ' + filePath + 'over ' + this.rewriteModules[dirKey][rwName][filePath] + ' !')
    this.rewriteModules[dirKey][rwName][filePath] = path.resolve(pluginPath, rewritFilePath)
  }

  /**
   * Create plugin instances
   * Check if a plugin need to be rewrite
   *
   * @param {Object} pluginsConfig Object object config and package indexed by plugin name
   * @private
   */
  _createPluginInstances (pluginsConfigs) {
    // Load plugins
    return utils.asyncMap(pluginsConfigs, async (pluginConfigs, name) => {
      const pkg = pluginConfigs.package
      let mainFile = pkg.main ? pkg.main : 'index.js'
      const pluginPath = path.parse(path.join(pluginConfigs.packagePath, mainFile)).dir
      let pluginFilePath = path.join(pluginConfigs.packagePath, mainFile)

      // Skip rewrite plugin
      if (this.rewritePlugins[name]) return

      // ceck if plugin is rewrited
      if (this.rewritedPlugins[name]) {
        // Config of plugin who rewrite
        const rewritePlugin = this.rewritedPlugins[name]
        // Config of plugin who rewrite
        const reweriteConfigs = pluginsConfigs[rewritePlugin]
        const _pkg = reweriteConfigs.package

        if (reweriteConfigs.config) pluginConfigs.config = reweriteConfigs.config

        mainFile = _pkg.main ? _pkg.main : 'index.js'
        pluginFilePath = path.join(reweriteConfigs.packagePath, mainFile)
      }

      return { key: name, value: this._createPluginInstance(name, pluginPath, pluginFilePath, pkg, pluginConfigs.config) }
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
  async _createPluginInstance (name, pluginPath, pluginFilePath, pkg, config) {
    // Import plugin main file
    const { default: PluginClass } = await import(pluginFilePath)

    // Create plugin intance
    const plugin = new PluginClass(this.mid, { name, path: pluginPath, package: pkg, config })

    // Init plugin
    await plugin.init()

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
    (typeof plugins[name] === 'object' && (plugins[name].enabled === undefined || plugins[name].enabled === true))
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
      this.mid.warn(`Plugin ${name} is already enabled !`)
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
      this.mid.warn(`Plugin ${name} is already disabled !`)
    }

    return false
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
   * Add a plugin module types
   *
   * @param {String} key         Directory key
   * @param {String} defaultPath Default path
   */
  addModuleType (key, defaultPath) {
    if (typeof key !== 'string') throw new Error('@midgar/midgar: Invalid key type !')
    if (typeof defaultPath !== 'string') throw new Error('@midgar/midgar: Invalid defaultPath type !')

    if (defaultPath.charAt(0) === '/') defaultPath = defaultPath.substr(1)
    this.moduleTypes[key] = defaultPath
  }

  /**
   * Return an array of object contain
   * the plugin and the dir found
   *
   * @param dir plugin dir key
   *
   * @return {Array}
   */
  /*
  async getDirs (dir) {
    if (!this.moduleTypes[dir]) {
      this.mid.warn('@midgar/midgar: Unknow plugin dir ' + dir)
    }

    return utils.asyncMap(this.plugins, async (plugin, name) => {
      if (!this.moduleTypes[dir] && !plugin.dirs[dir]) return null

      // get the routes path of the plugin
      const dirPath = path.join(plugin.path, plugin.dirs[dir] ? plugin.dirs[dir] : this.moduleTypes[dir])
      // check if the dir exist
      const exists = await utils.asyncFileExists(dirPath)
      if (exists) { return { plugin: name, path: dirPath } } else { return null }
    })
  }
  */

  /**
   * Import files inside a directory of each plugins
   *
   * @param {String}  dirkey   Plugin dir name
   * @param {RegExp}  regExp    Use to filter by filname
   * @param {Boolean} recursive Reacursive or not, it true by default
   *
   * @return {Array}
   */
  async importModules (dirkey, regExp = null, recursive = true) {
    if (!this.moduleTypes[dirkey]) throw new Error(`@midgar/midgar: Unknow plugin dir ${dirkey}`)

    const files = []
    // List plugins
    await utils.asyncMap(this.plugins, async (plugin) => {
      if (!this.moduleTypes[dirkey] && !plugin.dirs[dirkey]) return // skip

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
          if (this.rewriteModules[dirkey] !== undefined && this.rewriteModules[dirkey][plugin] !== undefined && this.rewriteModules[dirkey][plugin][relativePath] !== undefined) {
            importPath = this.rewriteModules[dirkey][plugin][relativePath]
          }

          const { default: defaultExport } = await import(importPath)
          result.push({ path: filePath, export: defaultExport, plugin, relativePath })
        } catch (error) {
          this.mid.error(error)
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
