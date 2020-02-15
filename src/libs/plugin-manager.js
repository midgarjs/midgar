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
 */
class PluginManager {
  /**
   * @param {Midgar} mid Midgar instance
   */
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
     * Rewrite modules dictionary
     * @type {object}
     */
    this.rewriteModules = {}

    /**
     * Rewrite files dictionary
     * @type {object}
     */
    this.rewriteFiles = {}

    // plugin dependencies object
    this._pluginDependencies = null

    /**
     * File path dictonary for caching
     * @private
     */
    this._filePaths = {}
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
     * @event @midgar/midgar:afterInitPlugins
     */
    await this.mid.emit('@midgar/midgar:afterInitPlugins')
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
      let packagePath
      let local = false

      // Check if plugin path is defined in plugins.json
      if (typeof pluginsConfig[name] !== 'boolean' && pluginsConfig[name].path !== undefined) {
        // Set path relative to Midgar config directory
        packagePath = path.join(this.mid.configPath, pluginsConfig[name].path)
        local = true
      }

      // If it a local plugin
      if (!local && pluginsConfig[name].local) {
        local = true
        packagePath = path.join(this.localPath, name)
      }

      // If it a npm package
      if (!local) {
        packagePath = path.dirname(await utils.asyncRequireResolve(path.join(name, PACKAGE_JSON)))
      }

      let pkg
      const pkgPath = path.join(packagePath, PACKAGE_JSON)
      try {
        // Import plugin package.json and plugin-config.js
        pkg = await import(pkgPath)
      } catch (error) {
        if (error.code && error.code === 'MODULE_NOT_FOUND') throw new Error(`package.json not found for plugin ${name} at ${pkgPath} ) !`)
        throw error
      }

      const mainFile = pkg.main ? pkg.main : 'index.js'

      // Set main file directory as plugin directory
      const pluginPath = path.parse(path.join(packagePath, mainFile)).dir

      const config = await this._importPluginConfig(pluginPath)

      if (name !== pkg.name) this.mid.warn(`Plugin name in plugins config ( ${name} ) is not equal to the package name ( ${pkg.name} ) !`)

      return {
        key: pkg.name,
        value: {
          package: pkg,
          config,
          packagePath,
          pluginPath
        }
      }
    }, true)
  }

  /**
   * Check if plugin config have rewritePlugin entry
   *
   * @param {object} pluginsConfigs Dictionay of plugin config and package.json
   * @private
   */
  _processPluginsConfig (pluginsConfigs) {
    for (const name in pluginsConfigs) {
      const pluginConfig = pluginsConfigs[name].config
      if (!pluginConfig) continue
      if (pluginConfig.rewrite) this._processRewriteConfig(name, pluginsConfigs)
      if (pluginConfig.config) this._mergeConfig(pluginConfig.config)
    }
  }

  /**
   * Merge midgar config to plugin config
   * The goal is to let possibility to the plugin
   * to define base configuration
   *
   * @param {object} config Config Object
   * @private
   */
  _mergeConfig (config) {
    this.mid.config = utils.assignRecursive(config, this.mid.config)
  }

  /**
   * Map rewrite config
   * Add rewrite entries in rewritePlugins Object
   *
   * @param {string} name           Plugin name
   * @param {object} pluginsConfigs Dictionay of plugin config and package.json
   * @private
   */
  _processRewriteConfig (name, pluginsConfigs) {
    const pluginConfig = pluginsConfigs[name].config
    // Map rewrite plugins
    if (pluginConfig.rewrite.plugin) {
      if (typeof pluginConfig.rewrite.plugin !== 'string') throw new TypeError(`Invalid rewrite plugin type in config of ${name} plugin !`)
      this._processRewritePlugin(name, pluginsConfigs)
    }

    // Map rewrite modules
    if (pluginConfig.rewrite.modules) {
      this._processRewriteModules(name, pluginsConfigs[name])
    }

    // Map rewrite files
    if (pluginConfig.rewrite.files) {
      this._processRewriteFiles(name, pluginsConfigs[name])
    }
  }

  /**
   * Check rewrite plugin and map entries
   * @private
   */
  _processRewritePlugin (name, pluginsConfigs) {
    // Check if plugin is configured to rewrite another plugin
    const rewritedPlugin = pluginsConfigs[name].config.rewrite.plugin

    if (pluginsConfigs[rewritedPlugin] === undefined) throw new Error(`Unknow plugin ${rewritedPlugin} !`)

    // Warn if the plugin is not already rewrite
    if (this.rewritePlugins[rewritedPlugin] !== undefined) this.mid.warn(`Plugin ${name} rewite ${rewritedPlugin} over ${this.rewritePlugins[rewritedPlugin]} !`)

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
    // List module types
    for (const moduleType in pluginConfig.rewrite.modules) {
      // List plugins
      for (const rwName in pluginConfig.rewrite.modules[moduleType]) {
        // List modules
        for (const filePath in pluginConfig.rewrite.modules[moduleType][rwName]) {
          const rewriteFilePath = pluginConfig.rewrite.modules[moduleType][rwName][filePath]
          this._processRewriteModulesEntry(moduleType, name, rwName, filePath, rewriteFilePath, pluginPath)
        }
      }
    }
  }

  /**
   * Create rewrite module doctionary entry
   *
   * @param {string} moduleType      Module type key
   * @param {string} name            Rewriter plugin name
   * @param {string} rwName          Rewrite plugin name
   * @param {string} filePath        Rewrited module path
   * @param {string} rewriteFilePath Rewrite module path
   * @param {string} pluginPath      Rewrite plugin path
   * @private
   */
  _processRewriteModulesEntry (moduleType, name, rwName, filePath, rewriteFilePath, pluginPath) {
    if (!this.rewriteModules[moduleType]) this.rewriteModules[moduleType] = {}
    if (!this.rewriteModules[moduleType][rwName]) this.rewriteModules[moduleType][rwName] = {}

    if (this.rewriteModules[moduleType][rwName][filePath] !== undefined) this.mid.warn(`Plugin ${name} rewite file ${this.rewriteModules[moduleType][rwName][filePath]} over plugin ${rwName} !`)
    this.rewriteModules[moduleType][rwName][filePath] = path.resolve(pluginPath, rewriteFilePath)
  }

  /**
   * Check rewrite files and map entries
   *
   * @param {string} name          Plugin name
   * @param {object} pluginConfigs plugin config and package.json
   * @private
   */
  _processRewriteFiles (name, pluginConfigs) {
    const pluginPath = pluginConfigs.pluginPath
    const pluginConfig = pluginConfigs.config
    // List plugin name entries
    for (const rwName in pluginConfig.rewrite.files) {
      for (const filePath in pluginConfig.rewrite.files[rwName]) {
        const rewriteFilePath = pluginConfig.rewrite.files[rwName][filePath]
        this._processRewriteFileEntry(name, rwName, filePath, rewriteFilePath, pluginPath)
      }
    }
  }

  /**
   * Create rewrite file doctionary entry
   *
   * @param {string} name            Rewriter plugin name
   * @param {string} rwName          Rewrite plugin name
   * @param {string} filePath        Rewrited module path
   * @param {string} rewriteFilePath Rewrite module path
   * @param {string} pluginPath      Rewrite plugin path
   * @private
   */
  _processRewriteFileEntry (name, rwName, filePath, rewriteFilePath, pluginPath) {
    if (!this.rewriteFiles[rwName]) this.rewriteFiles[rwName] = {}
    if (this.rewriteFiles[rwName][filePath] !== undefined) this.mid.warn(`Plugin ${name} rewite file ${this.rewriteFiles[rwName][filePath]} over plugin ${rwName} !`)
    this.rewriteFiles[rwName][filePath] = path.resolve(pluginPath, rewriteFilePath)
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

      await utils.asyncWriteFile(path.join(this.mid.configPath, PLUGINS_CONFIG_FILE), JSON.stringify(plugins, null, 4))

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
      await utils.asyncWriteFile(path.join(this.mid.configPath, PLUGINS_CONFIG_FILE), JSON.stringify(plugins, null, 4))
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

      await utils.asyncWriteFile(path.join(this.mid.configPath, PLUGINS_CONFIG_FILE), JSON.stringify(plugins, null, 4))
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

      await utils.asyncWriteFile(path.join(this.mid.configPath, PLUGINS_CONFIG_FILE), JSON.stringify(plugins, null, 4))
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
    if (this.plugins[name] === undefined) throw new Error(`Invalid plugin name: ${name} !`)
    return this.plugins[name]
  }

  /**
   * Add a plugin module types
   *
   * @param {string} key         Module type key
   * @param {string} modulesPath Relative path for modules directory
   * @param {string} globPattern Glob pattern, default is **\/*.js
   * @param {string} ignore      Ignore glob pattern or Array of glob pattern
   */
  addModuleType (key, modulesPath, globPattern = '**/*.js', ignore = null) {
    if (typeof key !== 'string') throw new Error('@midgar/midgar: Invalid key type !')
    if (typeof modulesPath !== 'string') throw new Error('@midgar/midgar: Invalid modulesPath type !')

    // Clean
    if (modulesPath.charAt(0) === '/') modulesPath = modulesPath.substr(1)

    if (!modulesPath.length) throw new Error('@midgar/midgar: Invalid path !')

    if (typeof globPattern !== 'string') throw new TypeError(`Invalid glob type for modules ${key}.`)
    if (ignore && typeof ignore !== 'string' && !Array.isArray(ignore)) throw new TypeError(`Invalid ignore type for modules ${key}.`)

    this.moduleTypes[key] = {
      path: modulesPath,
      glob: globPattern,
      ignore
    }
  }

  /**
   * Return a module type definition
   *
   * @param {string} type Module type
   *
   * @return {ModuleType}
   */
  getModuleType (type) {
    if (!this.moduleTypes[type]) throw new Error(`Unknow module type ${type}`)
    return this.moduleTypes[type]
  }

  /**
   * Import files inside a directory of each plugins
   *
   * @param {string}  type    Module type key
   * @param {boolean} import_ Flag to import or not modules
   *
   * @return {Array}
   */
  async importModules (type, import_ = true) {
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
        const pluginFiles = await this._importModuleFiles(plugin, type, pluginModuleType, import_)
        files.push(...pluginFiles)
      }
    })

    const time = utils.timer.getTime('midgar-import-modules-' + type)
    this.mid.debug(`@midgar/midgar: ${type} modules imported in ${time} ms.`)

    return files
  }

  /**
   * Return a module type object for a plugin
   *
   * @param {string} plugin Plugin name
   * @param {string} type   Module type
   *
   * @return {ModuleType}
   * @private
   */
  _getPluginModuleType (plugin, type) {
    const moduleType = { ...this.getModuleType(type) }
    const pluginModuleType = plugin.getModuleType(type)

    // Check path
    if (pluginModuleType.path !== undefined) {
      if (typeof pluginModuleType.path !== 'string') throw new TypeError(`Invalid path type for modules ${type} in config of plugin ${plugin}.`)
      moduleType.path = pluginModuleType.path
    }

    // Check glob
    if (pluginModuleType.glob !== undefined) {
      if (typeof pluginModuleType.glob !== 'string') throw new TypeError(`Invalid glob type for modules ${type} in config of plugin ${plugin}.`)
      moduleType.glob = pluginModuleType.glob
    }

    // Check ignore
    if (pluginModuleType.ignore !== undefined) {
      if (typeof pluginModuleType.ignore !== 'string' && !Array.isArray(pluginModuleType.ignore)) throw new TypeError(`Invalid ignore type for modules ${type} in config of plugin ${plugin}.`)
      moduleType.ignore = pluginModuleType.ignore
    }

    return moduleType
  }

  /**
   * Import module inside a plugin directory
   *
   * @param {Plugin}     plugin           Plugin isntance
   * @param {string}     type             Module type
   * @param {ModuleType} pluginModuleType Modules root absolute path
   * @param {boolean}    import_          Flag to import or not modules
   *
   * @raturn {Array}
   * @private
   */
  async _importModuleFiles (plugin, type, pluginModuleType, import_ = true) {
    const modulesDir = path.join(plugin.path, pluginModuleType.path)
    // Get modules file path array
    const files = await this._getFilesPath(modulesDir, pluginModuleType.glob, pluginModuleType.ignore)

    // List files async
    return utils.asyncMap(files, async (file) => {
      try {
        let importPath = path.join(modulesDir, file)

        // Check if module is rewrited
        if (this.rewriteModules[type] !== undefined && this.rewriteModules[type][plugin.name] !== undefined &&
          this.rewriteModules[type][plugin.name][file] !== undefined) {
          importPath = this.rewriteModules[type][plugin.name][file]
        }

        const moduleFile = {
          path: importPath,
          plugin: plugin.name,
          relativePath: file
        }

        // If import flag import file
        if (import_) {
          // Import module file
          const { default: defaultExport } = await import(importPath)
          moduleFile.export = defaultExport
        }

        return moduleFile
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
  _getFilesPath (dirPath, pattern, ignore = null) {
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
   * Return content of a plugin file
   *
   * @param {string} filePath Plugin file path like "plugin-name:path-to-file"
   * @param {string} encoding Read file encoding: https://nodejs.org/api/fs.html#fs_fs_readfile_path_options_callback
   *
   * @return {Promise<string|Buffer>}
   */
  async readFile (filePath, encoding = 'utf8') {
    filePath = this.getFilePath(filePath)
    return utils.asyncReadFile(filePath, encoding)
  }

  /**
   * Read plugin files from a glob pattern
   *
   * @param {string} globPattern Glob patter
   *
   * @returns {Array<File>}
   */
  async readFiles (globPattern) {
    const files = []
    // List plugins async
    await utils.asyncMap(this.plugins, async (plugin) => {
      // Get files path with glob pattern
      let filesPath = await this._getFilesPath(plugin.path, globPattern)

      // Add plugin namespace to files path
      filesPath = filesPath.map(filePath => plugin.name + ':' + filePath)

      // Read files async
      await utils.asyncMap(filesPath, async (filePath) => {
        const content = await this.readFile(filePath)

        files.push({
          plugin: plugin.name,
          content,
          path: filePath.split(':')[1]
        })
      })
    })

    return files
  }

  /**
   * Return absolute path of a plugin file
   *
   * @param {string} filePath Plugin file path like "plugin-name:path-to-file"
   *
   * @return {string} Absolute file path
   */
  getFilePath (filePath) {
    if (this._filePaths[filePath] === undefined) {
      const parts = filePath.split(':')
      if (parts.length !== 2) throw new Error('Invalid file path !')
      const plugin = this.getPlugin(parts[0])
      filePath = parts[1]

      if (!filePath.charAt(0).match(/[a-z]/i)) throw new Error('Invalid file path !')

      if (this.rewriteFiles[plugin.name] !== undefined &&
        this.rewriteFiles[plugin.name][filePath] !== undefined) this._filePaths[filePath] = this.rewriteFiles[plugin.name][filePath]
      else this._filePaths[filePath] = path.join(plugin.path, filePath)
    }

    return this._filePaths[filePath]
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
