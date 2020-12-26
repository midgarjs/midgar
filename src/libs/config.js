
const path = require('path')
const dotenv = require('dotenv')
const { merge, asyncFileExists } = require('./utils')

const CONFIG_FILE_NAME = 'config'

// Load .env file
dotenv.config()

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
    merge(config, mainConfig)

    let prefix
    if (env === 'development') {
        prefix = 'dev'
    } else if (env === 'production') {
        prefix = 'prod'
    } else {
        prefix = env
    }

    const modeConfig = await loadConfigfile(path.join(configDir, CONFIG_FILE_NAME + '.' + prefix))
    merge(config, modeConfig)

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
        return require(filePath)
    } else if (requireMode) {
        throw new Error(`the file ${filePath}.js doesn't exist !`)
    }
}

module.exports = {
    CONFIG_FILE_NAME,
    loadConfig
}

