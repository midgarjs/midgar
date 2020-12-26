const Emittery = require('emittery')

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
     * @param {App}        app     App instance
     * @param {PluginOptions} options Options
     */
    constructor (app) {
        super()

        /**
         * App Instance
         * @type {App}
         */
        this.app = app
    }

    /**
     * Init method
     *
     * @return {Promise<void>}
     */
    async init () { }
}

module.exports = Plugin
