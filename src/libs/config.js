
import path from 'path'
import { assignRecursive, asyncFileExists } from '@midgar/utils'

const CONFIG_FILE_NAME = 'config'

/**
 * Load config files in a folder
 * load the file {prefix}.config.json
 * load the file {prefix}.config.{MODE}.json
 * Mode are prod and dev
 *
 * @param {string} configDir config directory path
 * @param {string} prefix config prefix for the files name
 * @param {boolean} require require flag
 * 
 * @return {object}
 * @private
 */
async function loadConfig (configDir, env) {
  const config = {}
  const mainConfig = await loadConfigfile(path.join(configDir, CONFIG_FILE_NAME), true)
  assignRecursive(config, mainConfig)

  const modeConfig = await loadConfigfile(path.join(configDir, CONFIG_FILE_NAME + '.' + env))
  assignRecursive(config, modeConfig)

  return config
}

/**
 * load a config file, parse the json and merge it into the config object
 * if the require flag is at true and the file not exist throw an error
 *
 * @param {string} filePath config file path
 * @param {boolean} requireMode require flag
 *
 * @return {Object|Array}
 * @private
 */
async function loadConfigfile (filePath, requireMode = false) {
  const exist = await asyncFileExists(filePath + '.js')
  if (exist) {
    const { default: config } = await import(filePath)
    return config
  } else if (requireMode) {
    throw new Error(`@midgar/midgar: the file ${filePath}.js doesn't exist !`)
  }
}

export {
  CONFIG_FILE_NAME,
  loadConfig
}

export default loadConfig
