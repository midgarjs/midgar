
import Emittery from 'emittery'
import path from 'path'

/**
 * Plugin class
 * @class
 * @abstract
 */
class Plugin extends Emittery {
  constructor (mid, options) {
    super()

    this.mid = mid

    if (!options.name) throw new Error('The plugin have no name')

    /**
     * Plugin name
     * @var {String}
     */
    this.name = options.name

    if (!options.path) throw new Error('The plugin as no path')

    /**
     * Plugin path
     * @var {String}
     */
    this.path = options.path

    /**
     * Plugin config from plugin-config.js
     * @var {Object}
     */
    this.config = options.config || {}

    /**
     * Plugin dirs from plugin-config.js
     * @var {Object}
     */
    this.dirs = this.config.dirs || {}

    /**
     * Plugin Manager
     * @var {PluginManager}
     */
    this.pm = mid.pm

    /**
     * package.json
     * @var {Object}
     */
    this.package = options.package
  }

  /**
   * Init method
   */
  async init () {}

  /**
   * Return a dir path by is name
   * @param {String} name
   * @return {String}
   */
  getDir (name) {
    if (!this.pm.moduleTypes[name] && !this.dirs[name]) {
      this.mid.warn('Unknow plugin dir ' + name)
      return null
    }

    return this.dirs[name] ? this.dirs[name] : this.pm.moduleTypes[name]
  }

  getDirPath (name) {
    const dir = this.getDir(name)
    return dir ? path.join(this.path, dir) : null
  }
}

export default Plugin
