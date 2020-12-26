/**
 * @typedef {Object} PluginDef
 * @property {string}      name   Plugin name
 * @property {constructor} plugin Plugin class
 * @property {Array<string>} dependencies Dependencies plugin names
 */

/**
 * PluginMaganger class
 * Manage plugins
 */
class PluginManager {
    /**
     * @param {App} app App instance
     */
    constructor (app) {
        /**
         * App instance
         * @type {App}
         */
        this.app = app

        this._pluginDefs = {}

        /**
         * Plugins instance Dictionary by plugin name
         * @type {object}
         */
        this.plugins = {}
    }

    /**
     * Add a plugin définition
     */
    async addPlugin (plugin) {
        this._pluginDefs[plugin.name] = plugin
    }

    /**
     * Load plugins files
     *
     * @param {object} pluginsLoadConfig Plugins config object (plugins.json)
     *
     * @return {Promise<Object>}
     */
    async initPlugins () {
        for (const name in this._pluginDefs) {
            if (this.plugins[name] === undefined) {
                this.plugins[name] = await this._createPluginInstance(name)
            }
        }
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
     * This method exist only for been mock durting test
     *
     * @param {String} name module name
     *
     * @return {module}
     * @private
     */
    _require (name) {
        return require(name)
    }

    /**
     * Create plugin instance and init plugin
     *
     * @param {String}      name        Plugin name
     * @param {String}      pluginPath  Plugin path
     *
     * @return {Promise<Plugin>}
     * @private
     */
    async _createPluginInstance (name, parents = []) {
        if (this._pluginDefs[name] === undefined) {
            let pluginDef
            try {
                pluginDef = this._require(name)
            } catch (error) {
                this.app.debug(error)
                throw new Error(`Cannot find npm package for plugin ${name} !`)
            }
            this._pluginDefs[name] = pluginDef
        }

        const pluginDef = this._pluginDefs[name]

        let PluginClass = pluginDef.plugin

        const args = [this.app]
        if (pluginDef.dependencies) {
            parents.push(name)

            for (const dependency of pluginDef.dependencies) {
                if (parents.indexOf(dependency) !== -1) {
                    throw new Error(
                        `Circular dependency in plugin ${name}, ${dependency} already depend on ${name} (${parents.join('->')})!`
                    )
                }

                if (this.plugins[dependency] === undefined) {
                    this.plugins[dependency] = await this._createPluginInstance(dependency, [...parents])
                }
                args.push(this.plugins[dependency])
            }
        }

        this.app.debug(`PM: Create plugin instance ${name}.`)
        // Create plugin intance
        const plugin = new PluginClass(...args)

        this.plugins[name] = plugin
        await plugin.init()

        return plugin
    }

}

module.exports = PluginManager
