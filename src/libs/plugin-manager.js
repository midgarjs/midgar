import path from 'path'
import glob from 'glob'
import utils from '@midgar/utils'

const PACKAGE_JSON = 'package.json'
export const PLUGIN_CONFIG_FILE = 'plugin-config.js'
export const PLUGINS_CONFIG_FILE = 'plugins.json'

/**
 * @typedef {Object} ModuleType
 * @property {string}       path   Modules path
 * @property {string}       glob   Glob pattern
 * @property {string|Array} ignore Ignore glob pattern
 */

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
     * @type {object}
     */
    this.plugins = {}

    /**
     * local plugins directory path
     * @type {string}
     */
    this.localPath = mid.config.pluginsLocalPath

    /**
     * Module types dictionary
     * @type {object}
     */
    this.moduleTypes = {}

    /**
     * Rewrite plugin dictionary
     * @type {object}
     */
    this.rewritePlugins = {}

    /**
     * Rewrited plugin dictionary
     * @type {object}
     */
    this.rewritedPlugins = {}

    /**
     * Rewrite modules
     * @type {object}
     */
    this.rewriteModules = {}

    // plugin dependencies object
    this._pluginDependencies = null
  }

  /**
   * Init plugin manager
   * Get the enabled plugins from the config and load them
   *
   * @return {Promise<void>}
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
   * @param {object} pluginsConfig Plugins config object (plugins.json)
   *
   * @return {Promise<void>}
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
   * @param {object} pluginsConfig Plugins config object (plugins.json)
   *
   * @return {Promise<object>}
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
   * @param {object} pluginsConfigs Dictionay of plugin config and package.json
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
   * @param {string} name         Plugin name
   * @param {object} pluginConfigs plugin config and package.json
   * @private
   */
  _processRewriteModules (name, pluginConfigs) {
    const pluginPath = pluginConfigs.pluginPath
    const pluginConfig = pluginConfigs.config
    // List plugin directories
    for (const moduleType of Object.keys(pluginConfig.rewrite.modules)) {
      // List plugins
      for (const rwName of Object.keys(pluginConfig.rewrite.modules[moduleType])) {
        // List plugins
        for (const filePath of Object.keys(pluginConfig.rewrite.modules[moduleType][rwName])) {
          const rewritFilePath = pluginConfig.rewrite.modules[moduleType][rwName][filePath]
          this._processrewriteModulesEntry(moduleType, name, rwName, filePath, rewritFilePath, pluginPath)
        }
      }
    }
  }

  /**
   * Create rewrite module doctionary
   *
   * @param {string} moduleType     Module type key
   * @param {string} name           Rewriter plugin name
   * @param {string} rwName         Rewrite plugin name
   * @param {string} filePath       Rewrited module path
   * @param {string} rewritFilePath Rewrite module path
   * @param {string} pluginPath     Rewrite plugin path
   * @private
   */
  _processrewriteModulesEntry (moduleType, name, rwName, filePath, rewritFilePath, pluginPath) {
    if (!this.rewriteModules[moduleType]) this.rewriteModules[moduleType] = {}
    if (!this.rewriteModules[moduleType][rwName]) this.rewriteModules[moduleType][rwName] = {}

    if (this.rewriteModules[moduleType][rwName][filePath] !== undefined) this.mid.warn('Plugin ' + name + ' rewite ' + rwName + ' ' + filePath + 'over ' + this.rewriteModules[moduleType][rwName][filePath] + ' !')
    this.rewriteModules[moduleType][rwName][filePath] = path.resolve(pluginPath, rewritFilePath)
  }

  /**
   * Create plugin instances
   * Check if a plugin need to be rewrite
   *
   * @param {object} pluginsConfig Object object config and package indexed by plugin name
   *
   * @return {Promise<Object>}
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
   * @param {string} name       Plugin name
   * @param {string} pluginPath Plugin path
   * @param {object} pkg        Plugin package.json
   * @param {object} config     Plugin config from plugin-config.js
   *
   * @return {Promise<Plugin>}
   * @private
   */
  async _createPluginInstance (name, pluginPath, pluginFilePath, pkg, config) {
    this.mid.debug(`@midgar:midgar: Create plugin instance: ${pluginPath}.`)
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
   * @param {string} pluginPath Plugin path
   *
   * @return {Promise<object>}
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
   * Check if a plugin exist in local pligin path
   *
   * @param {String} name Plugin name
   *
   * @return {Promise<boolean>}
   * @private
   */
  _isLocalPlugin (name) {
    return utils.asyncFileExists(path.join(this.localPath, name))
  }

  /**
   * Add a plugin in the plugins.json config file
   * Return true if the plugin was added or false
   *
   * @param {string} name Plugin name
   * @return {boolean}
   */
  async addPlugin (name) {
    const { default: plugins } = await import(path.join(this.mid.configPath, PLUGINS_CONFIG_FILE))

    if (plugins[name] === undefined) {
      if (await this._isLocalPlugin(name)) {
        plugins[name] = {
          local: true
        }
      } else {
        plugins[name] = true
      }

      await utils.asyncWriteFile(path.join(this.mid.configPath, PLUGINS_CONFIG_FILE), JSON.stringify(plugins))

      return true
    }

    return false
  }

  /**
   * Remove a plugin from the plugins.json config file
   * Return true if the plugin was removed or false
   *
   * @param {string} name Plugin name
   * @return {boolean}
   */
  async removePlugin (name) {
    const { default: plugins } = await import(path.join(this.mid.configPath, PLUGINS_CONFIG_FILE))

    if (plugins[name] === undefined) {
      this.mid.warn(notAddedPluginError(name))
    } else {
      delete plugins[name]
      await utils.asyncWriteFile(path.join(this.mid.configPath, PLUGINS_CONFIG_FILE), JSON.stringify(plugins))
      return true
    }

    return false
  }

  /**
   * Check if the plugin is enabled
   *
   * @param {string} name    Plugin name
   * @param {object} plugins Plugins config (plugins.json)
   * @return {boolean}
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
   * @param {string} name Plugin name
   * @return {boolean}
   */
  async enablePlugin (name) {
    const { default: plugins } = await import(path.join(this.mid.configPath, PLUGINS_CONFIG_FILE))

    if (plugins[name] === undefined) {
      this.mid.warn(notAddedPluginError(name))
    } else if (!this._isEnabledPlugin(name, plugins)) {
      if (typeof plugins[name] === 'boolean') {
        plugins[name] = true
      } else {
        delete plugins[name].enabled
      }

      await utils.asyncWriteFile(path.join(this.mid.configPath, PLUGINS_CONFIG_FILE), JSON.stringify(plugins))
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
   * @param {string} name Plugin name
   * @return {boolean}
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

      await utils.asyncWriteFile(path.join(this.mid.configPath, PLUGINS_CONFIG_FILE), JSON.stringify(plugins))
      return true
    } else {
      this.mid.warn(`Plugin ${name} is already disabled !`)
    }

    return false
  }

  /**
   * Return a plugin instance by name
   *
   * @param {string} name Plugin name
   * @return {Plugin}
   */
  getPlugin (name) {
    return this.plugins[name]
  }

  /**
   * Add a plugin module types
   *
   * @param {string} key   Module type key
   * @param {string} path   Relative path for modules directory
   * @param {string} glob   Glob pattern, default is **\/*.js
   * @param {string} ignore Ignore glob pattern or Array of glob pattern
   */
  addModuleType (key, path, glob = '**/*.js', ignore = null) {
    if (typeof key !== 'string') throw new Error('@midgar/midgar: Invalid key type !')
    if (typeof path !== 'string') throw new Error('@midgar/midgar: Invalid path type !')

    // Clean
    if (path.charAt(0) === '/') path = path.substr(1)

    if (!path.length) throw new Error('@midgar/midgar: Invalid path !')

    if (typeof glob !== 'string') throw new TypeError(`@midgar/midgar: Invalid glob type for modules ${key}.`)
    if (ignore && typeof ignore !== 'string' && !Array.isArray(ignore)) throw new TypeError(`@midgar/midgar: Invalid ignore type for modules ${key}.`)

    this.moduleTypes[key] = {
      path,
      glob,
      ignore
    }
  }

  /**
   * Return a module type definition
   *
   * @param {*} type Module type
   *
   * @return {ModuleType}
   */
  getModuleType (type) {
    if (!this.moduleTypes[type]) throw new Error(`@midgar/midgar: Unknow module type ${type}`)
    return this.moduleTypes[type]
  }

  /**
   * Import files inside a directory of each plugins
   *
   * @param {string}  type  Module type key
   *
   * @return {Array}
   */
  async importModules (type) {
    // Start timer
    utils.timer.start('midgar-import-modules-' + type)
    this.mid.debug(`@midgar/midgar: import modules "${type}" start.`)

    const files = []
    // List plugins async
    await utils.asyncMap(this.plugins, async (plugin) => {
      if (!this.moduleTypes[type]) return // skip

      const pluginModuleType = this._getPluginModuleType(plugin, type)

      // check if the dir exist
      const exists = await utils.asyncFileExists(path.join(plugin.path, pluginModuleType.path))
      if (exists) {
        // Import files inside the direactory
        const pluginFiles = await this._importModuleFiles(plugin, type, pluginModuleType)
        files.push(...pluginFiles)
      }
    })

    const time = utils.timer.getTime('midgar-import-modules-' + type)
    this.mid.debug(`@midgar/midgar: "${type}" modules imported in ${time} ms.`)

    return files
  }

  /**
   * Return a module type object for a plugin
   *
   * @param {string}       plugin      Plugin name
   * @param {string}       type        Module type
   *
   * @return {ModuleType}
   * @private
   */
  _getPluginModuleType (plugin, type) {
    const moduleType = this.getModuleType(type)
    const pluginModuleType = plugin.getModuleType(type)

    // Check path
    if (pluginModuleType.path !== undefined) {
      if (typeof pluginModuleType.path !== 'string') throw new TypeError(`@midgar/midgar: Invalid path type for modules ${type} in config of plugin ${plugin}.`)
      moduleType.path = pluginModuleType.path
    }

    // Check glob
    if (pluginModuleType.glob !== undefined) {
      if (typeof pluginModuleType.glob !== 'string') throw new TypeError(`@midgar/midgar: Invalid glob type for modules ${type} in config of plugin ${plugin}.`)
      moduleType.glob = pluginModuleType.glob
    }

    // Check ignore
    if (pluginModuleType.ignore !== undefined) {
      if (typeof pluginModuleType.ignore !== 'string' && !Array.isArray(pluginModuleType.ignore)) throw new TypeError(`@midgar/midgar: Invalid ignore type for modules ${type} in config of plugin ${plugin}.`)
      moduleType.ignore = pluginModuleType.ignore
    }

    return moduleType
  }

  /**
   * Import module inside a plugin directory
   *
   * @param {Plugin}        plugin           Plugin isntance
   * @param {string}        type             Module type
   * @param {ModuleType} pluginModuleType Modules root absolute path
   *
   * @raturn {Array}
   * @private
   */
  async _importModuleFiles (plugin, type, pluginModuleType) {
    const modulesDir = path.join(plugin.path, pluginModuleType.path)
    // Get modules file path array
    const files = await this._getModuleFiles(modulesDir, pluginModuleType.glob, pluginModuleType.ignore)

    // List files async
    return utils.asyncMap(files, async (file) => {
      try {
        let importPath = path.join(modulesDir, file)

        // Check if module is rewrited
        if (this.rewriteModules[type] !== undefined && this.rewriteModules[type][plugin.name] !== undefined &&
          this.rewriteModules[type][plugin.name][file] !== undefined) {
          importPath = this.rewriteModules[type][plugin.name][file]
        }

        // Import module file
        const { default: defaultExport } = await import(importPath)

        return {
          path: importPath,
          export: defaultExport,
          plugin: plugin.name,
          relativePath: file
        }
      } catch (error) {
        this.mid.error(error)
      }
    })
  }

  /**
   * Return modules file path with glob
   *
   * @param {string}       dirPath Current working directory
   * @param {string}       pattern Glob pattern
   * @param {string|Array} ignore Ignore pattern or Array of ignore pattern
   *
   * @return {Array}
   * @private
   */
  _getModuleFiles (dirPath, pattern, ignore = null) {
    return new Promise((resolve, reject) => {
      const options = { cwd: dirPath }
      if (ignore) options.ignore = ignore
      glob(pattern, options, (err, files) => {
        if (err) reject(err)
        else resolve(files)
      })
    })
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
   * @param {object} deps
   * @return {object}
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
   * @return {boolean}
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
   * @return {object}
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
