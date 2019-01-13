var fs = require('fs')
var path = require('path')
const {assignRecursive} = require('@midgar/utils')

/**
 * Config class
 * @description Manage config files
 */
class Config {
  constructor(options = {}) {
    this.options = Object.assign({
        ext: 'js'
      }, options)
  }
  /**
   * Load config files in a folder
   * load the file {prefix}.config.json
   * load the file {prefix}.config.{MODE}.json
   * Mode are prod and dev
   *
   * @param {string} configDir config directory path
   * @param {string} prefix config prefix for the files name
   * @param {boolean} require require flag
   */
  async loadConfigs (configDir, prefix, requireMode = false) {
    if (!prefix)
      throw new Exception ('the prefix is not set')

    let file = prefix
    const mainConfig = await this.loadConfig(path.join(configDir, file))
    assignRecursive(this, mainConfig)

      //get the mode file
    const mode = process.env.NODE_ENV == 'development' ? 'dev' : 'prod'
    file += '.' + mode 

    const modeConfig = this.loadConfig(path.join(configDir, file), requireMode)
    assignRecursive(this, modeConfig)
  }

  /**
   * load a file, parse the json and merge it into the config object
   * if the require flag is at true and the file not exist throw an error
   *
   * @param {string} filePath config file path
   * @param {boolean} requireMode require flag
   *
   * @return Object || Array
   */
  async loadConfig (filePath, requireMode = true) {
    filePath += '.' + this.options.ext
    if (fs.existsSync(filePath)) {
      if (this.options.ext == 'js') {
        return require (filePath)
      } else if (this.options.ext == 'json') {
        let config = fs.readFileSync(filePath, 'utf8')
        return JSON.parse(config)
      } else {
        throw new Error('unknow config ext !')
      }
    } else if (requireMode) {
      throw new Error('the file ' + filePath + ' doesn\'t exist !')
    }
  }
}

module.exports = Config
