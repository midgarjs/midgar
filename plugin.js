const _Plugin = require('@midgar/plugin-manager/plugin')

/**
 * Plugin class
 * Extend plugin to add Midgar instance
 */
class Plugin extends _Plugin {
  /**
   * 
   * @param {Midgar} midgar Midgar instance
   * @param {Object} options Plugin options
   */
  constructor(midgar, options) {
    super(midgar.pm, options)
    this.midgar = midgar
  }
  //nice stuff
}


module.exports = Plugin