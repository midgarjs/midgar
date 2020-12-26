const path = require('path')
const { timer, isObject, asyncGlob } = require('./utils')
/**
 * @typedef {Object} ModuleDef
 * @property {string}      name   Module name
 * @property {constructor} module Module class
 * @property {Array<string>} dependencies Dependencies module names
 */


/**
 * Container class
 * Dependency injection container
 */
module.exports = class Container {
    /**
     * @param {App} app App instance 
     */
    constructor (app) {
        /**
         * App Instance
         * @type {App}
         */
        this.app = app

        /**
         * Module définitions dictionnary
         */
        this._moduleDefs = {}

        /**
         * Module instances définition
         */
        this._moduleInstances = {}
    }

    /**
     * Add a module définition
     * 
     * @param {string}    type              Module type 
     * @param {ModuleDef} moduleDef         Module définition
     * @param {string}    dependenciesType  Default dependency type for DI
     * 
     * @returns {void}
     */
    addModule (type, moduleDef, dependenciesType = null) {
        if (!dependenciesType) dependenciesType = type

        moduleDef = { dependenciesType, ...moduleDef }
        try {
            this._checkModuleDef(moduleDef)
        } catch (error) {
            const moduleDefString = JSON.stringify(moduleDef, null, '  ')
            throw new Error(`${error.message}\n${moduleDefString}`)
        }


        if (this._moduleDefs[type] === undefined) {
            this._moduleDefs[type] = {}
        }

        this._moduleDefs[type][moduleDef.name] = moduleDef
    }

    /**
     * Check a module definition and throw an Error
     * if somthing wrong
     * 
     * @param {ModuleDef} moduleDef Module définition
     * 
     * @private
     */
    _checkModuleDef (moduleDef) {
        if (typeof moduleDef !== 'object') throw new TypeError(`Invalid module définition type !`)
        if (moduleDef.module === undefined) throw new Error(`No module propertie in module définition !`)
        if (moduleDef.name === undefined) throw new Error(`No name propertie in module définition !`)

        if (typeof moduleDef.name !== 'string') throw new TypeError(`Invalid module name type !`)
        if (typeof moduleDef.dependenciesType !== 'string') throw new Error(`Invalid dependenciesType type in module définition !`)


        if (typeof moduleDef.module !== 'function')
            throw new TypeError(`Invalid module type !`)

        if (moduleDef.dependencies === undefined) return

        if (!Array.isArray(moduleDef.dependencies))
            throw new TypeError(`Invalid dependencies type !`)

        for (const dependency of moduleDef.dependencies) {
            if (isObject(dependency)) {
                if (dependency.name === undefined) throw new Error(`No name propertie in module dependency !`)
                if (typeof dependency.name !== 'string') throw new TypeError(`Invalid name type in module dependency !`)
                if (dependency.type === undefined) throw new Error(`No type propertie in module dependency !`)
                if (typeof dependency.type !== 'string') throw new TypeError(`Invalid type type in module dependency !`)
            } else if (typeof dependency !== 'string') {
                throw new TypeError(`Invalid module dependency type !`)
            }
        }
    }

    /**
     * Add a directory of module
     * 
     * Load all module in the dirPath with the glob pattern
     * 
     * @param {String} type                    Module type
     * @param {String} dirPath                 Directory path
     * @param {String} pattern                 Glob pattern
     * @param {string} defaultDependenciesType Default dependency type for DI
     * 
     * @returns {Promise<void>}
     */
    async addModuleDir (type, dirPath, pattern, dependenciesType = null) {
        if (dependenciesType === null) dependenciesType = type
        const moduleFiles = await asyncGlob(dirPath, pattern)

        for (const fileName of moduleFiles) {
            const moduleDef = require(path.join(dirPath, fileName))
            this.addModule(type, moduleDef, dependenciesType)
        }
    }

    /**
     * Instanciate all module
     * 
     * @param {String} type Module type
     * 
     * @returns {void}
     */
    intanciateModules (type) {
        if (this._moduleDefs[type] !== undefined) {
            for (const name in this._moduleDefs[type]) {
                this.getModule(type, name)
            }
        }
    }

    /**
     * Return module instances
     * 
     * @param {string} type Module type
     */
    getInstances (type) {
        return this._moduleInstances[type] ? this._moduleInstances[type] : []
    }

    /**
     * Return an instance of a module
     * 
     * @param {string} type Module type
     * @param {string} name Module name
     * 
     * @returns {any}
     */
    getModule (type, name) {
        return this._getModule(type, name)
    }

    /**
     * Return an instance of a module
     * 
     * @param {string} type    Module type
     * @param {string} name    Module name
     * @param {array}  parents Array of parents modules
     * 
     * @private
     * @returns {any}
     */
    _getModule (type, name, parents = []) {
        if (this._moduleInstances[type] === undefined) this._moduleInstances[type] = {}
        if (this._moduleInstances[type][name] === undefined) {
            this._moduleInstances[type][name] = this._createModuleInstance(type, name, parents)
        }

        return this._moduleInstances[type][name]
    }

    /**
     * Create an instance of a module
     * 
     * @param {string} type    Module type
     * @param {string} name    Module name
     * @param {array}  parents Array of parents modules
     * 
     * @private
     * @returns {any}
     */
    _createModuleInstance (type, name, parents = []) {
        if (this._moduleDefs[type] === undefined || this._moduleDefs[type][name] === undefined) {
            throw new Error(`Unknow module ${name} of type ${type}.`)
        }

        const timeKey = `module-${type}-${name}-init`
        timer.start(timeKey)

        parents.push(type + ':' + name)

        const moduleDef = this._moduleDefs[type][name]
        let instance
        let dependencies = []
        if (moduleDef.dependencies && moduleDef.dependencies.length) {
            dependencies = this._getModuleDependencies(type, moduleDef, parents)
        }

        const args = [this.app]

        args.push(...dependencies)
        // If the service is a class
        if (/^class\s/.test(Function.prototype.toString.call(moduleDef.module))) {
            const Class = moduleDef.module
            instance = new Class(...args)
        } else {
            instance = moduleDef.module(...args)
        }

        const time = timer.getTime(timeKey)
        this.app.debug(`Create module ${type} instance ${name} in ${time} ms.`)

        return instance
    }

    /**
     * Retrun an array of dependencies instance
     * 
     * @param {string} moduleType Parent module type
     * @param {string} moduleDef  Parent module name
     * @param {array}  parents    Array of parents modules
     * 
     * @private
     * @returns {Array<any>}
     */
    _getModuleDependencies (moduleType, moduleDef, parents) {
        const depependencies = []
        for (const dependency of moduleDef.dependencies) {

            let type = moduleDef.dependenciesType
            let name
            if (isObject(dependency)) {
                type = dependency.type
                name = dependency.name
            } else if (typeof dependency === 'string') {
                name = dependency
            }

            if (parents.indexOf(type + ':' + name) !== -1) {
                throw new Error(
                    `Circular dependency in module ${moduleType}:${moduleDef.name}, ${type}:${name} already depend on ${moduleType}:${moduleDef.name} (${parents.join('->')})!`
                )
            }

            depependencies.push(this._getModule(type, name, JSON.parse(JSON.stringify(parents))))
        }

        return depependencies
    }
}

