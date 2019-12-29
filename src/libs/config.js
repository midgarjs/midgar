
import path from 'path'
import { assignRecursive, asyncFileExists } from '@midgar/utils'

/**
 * Config class
 * @description Manage config files
 * @class
 */
class Config {
  constructor (midgar, options = {}) {
    this.midgar = midgar
    this.options = Object.assign({
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
  async loadConfigs (configDir, prefix) {
    if (!prefix) { throw new Error('the prefix is not set') }

    let file = prefix
    const mainConfig = await this.loadConfig(path.join(configDir, file), true)
    assignRecursive(this, mainConfig)

    // Get the mode
    const mode = this.midgar.getModeEnv() === 'development' ? 'dev' : 'prod'
    file += '.' + mode

    const modeConfig = await this.loadConfig(path.join(configDir, file))
    assignRecursive(this, modeConfig)
  }

  /**
   * load a config file, parse the json and merge it into the config object
   * if the require flag is at true and the file not exist throw an error
   *
   * @param {string} filePath config file path
   * @param {boolean} requireMode require flag
   *
   * @return {Object|Array}
   */
  async loadConfig (filePath, requireMode = false) {
    const exist = await asyncFileExists(filePath + '.js')
    if (exist) {
      const { default: config } = await import(filePath)
      return config
    } else if (requireMode) {
      throw new Error('the file ' + filePath + ' doesn\'t exist !')
    }
  }
}

export default Config
