const Emittery = require('emittery')
const path = require('path')
const utils = require('@midgar/utils')

/**
 * Plugin class
 * @abstract
 */
class Plugin extends Emittery {
  constructor (midgar, options) {
    super()

    this.midgar = midgar

    if (!options.name) {
      throw new Error('The plugin as no name')
    }

    //plugin name
    this.name = options.name

    if (!options.path) {
      throw new Error('The plugin as no path')
    }

    //plugin path
    this.path = options.path

    //plugin config
    this.config = options.config ? options.config : {}

    //plugin dirs
    this.dirs = {}

    this.pm = midgar.pm
    this.package = options.package
  }

  async init() {
    
  }


  /**
   * Return a dir path by is name
   * @param {*} name 
   */
  getDir(name) {
    if (!this.pm.pluginDirs[name] && !this.dirs[name]) {
      this.pm.emit('warn', 'Unknow plugin dir ' + name)
      return null
    }

    return this.dirs[name] ? this.dirs[name] : this.pm.pluginDirs[name]
  }

  getDirPath(name) {
    let dir = this.getDir(name)
    return dir ? path.join(this.path, dir) : null
  }
}

module.exports = Plugin