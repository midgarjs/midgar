import Emittery from 'emittery'

/**
 * @typedef {Object} PluginOptions
 * @property {string}       name   Plugin name
 * @property {string}       path   Plugin path
 * @property {PluginConfig} config Plugin config from plugin-config.js
 * @private
 */

/**
 * @typedef {Object} PluginConfig
 * @property {Object}       modulesTypes Module types dictionnary
 * @property {Object}       rewite       Rewrite config
 */

/**
 * Plugin class
 * @class
 * @abstract
 */
class Plugin extends Emittery {
  /**
   * @param {Midgar}        mid     Midgar instance
   * @param {PluginOptions} options Options
   */
  constructor (mid, options) {
    super()

    /**
     * Midgar Instance
     * @var {Midgar}
     */
    this.mid = mid

    if (!options.name) throw new Error('@midgar:midgar: The plugin have no name !')

    /**
     * Plugin name
     * @var {string}
     */
    this.name = options.name

    if (!options.path) throw new Error(`@midgar:midgar: Plugin "${this.name}" have no path !`)

    /**
     * Plugin absolute path
     * @var {string}
     */
    this.path = options.path

    /**
     * Plugin config from plugin-config.js
     * @var {PluginConfig}
     */
    this.config = options.config || {}

    /**
     * Module types from plugin-config.js
     * @var {object}
     */
    this.moduleTypes = this.config.moduleTypes || {}

    /**
     * Plugin Manager
     * @var {PluginManager}
     */
    this.pm = mid.pm

    /**
     * Package.json
     * @var {object}
     */
    this.package = options.package
  }

  /**
   * Init method
   *
   * @return {Promise<void>}
   */
  async init () {}

  /**
   * Return plugin module type configuration
   *
   * @param {string} type Module type
   *
   * @return {ModuleType}
   */
  getModuleType (type) {
    const moduleType = this.moduleTypes[type] !== undefined ? this.moduleTypes[type] : null

    const result = {}
    if (moduleType) {
      if (typeof moduleType === 'string') {
        return {
          path: moduleType
        }
      }

      if (typeof moduleType !== 'object') throw new TypeError(`Invalid module type config in plugin ${this.name} for modules ${type} !`)
      if (moduleType.glob !== undefined) result.glob = moduleType.glob
      if (moduleType.ignore !== undefined) result.ignore = moduleType.ignore
      if (moduleType.path !== undefined) result.path = moduleType.path
    }

    return result
  }
}

export default Plugin
