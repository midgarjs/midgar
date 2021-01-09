const path = require('path')
const { isObject, asyncGlob } = require('./utils')

/**
 * @typedef {Object} ServiceDef
 * @property {string}        name         Service name
 * @property {constructor}   service      Service class
 * @property {Array<string>} dependencies Dependencies service names
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
     * Service définitions dictionnary
     */
    this._serviceDefs = {}

    /**
     * Service instances dictionnary
     */
    this._instances = {}
  }

  /**
   * Add a service définition
   * 
   * @param {string}     type       Service type 
   * @param {ServiceDef} serviceDef Service définition
   * 
   * @returns {void}
   */
  addService (serviceDef) {
    try {
      this._checkServiceDef(serviceDef)
    } catch (error) {
      const serviceDefString = JSON.stringify(serviceDef, null, '  ')
      throw new Error(`${error.message}\n${serviceDefString}`)
    }

    this._serviceDefs[serviceDef.name] = serviceDef
  }

  /**
   * Check a service definition and throw an Error
   * if somthing wrong
   * 
   * @param {ServiceDef} serviceDef Service définition
   * 
   * @private
   */
  _checkServiceDef (serviceDef) {
    if (typeof serviceDef !== 'object') throw new TypeError(`Invalid service définition type !`)
    if (serviceDef.service === undefined) throw new Error(`No service propertie in service définition !`)
    if (serviceDef.name === undefined) throw new Error(`No name propertie in service définition !`)

    if (typeof serviceDef.name !== 'string') throw new TypeError(`Invalid service name type !`)


    if (typeof serviceDef.service !== 'function')
      throw new TypeError(`Invalid service type !`)

    if (serviceDef.dependencies === undefined) return

    if (!Array.isArray(serviceDef.dependencies))
      throw new TypeError(`Invalid dependencies type !`)

    for (const dependency of serviceDef.dependencies) {
      if (typeof dependency !== 'string')
        throw new TypeError(`Invalid service dependency type !`)
    }
  }

  /**
   * Add a directory of service
   * 
   * Load all service in the dirPath with the glob pattern
   * 
   * @param {String} dirPath                 Directory path
   * @param {String} pattern                 Glob pattern
   * 
   * @returns {Promise<void>}
   */
  async addServiceDir (dirPath, pattern) {
    const serviceFiles = await asyncGlob(dirPath, pattern)

    for (const fileName of serviceFiles) {
      const serviceDef = require(path.join(dirPath, fileName))
      this.addService(serviceDef)
    }
  }

  /**
   * Return an instance of a service
   * 
   * @param {string} name Service name
   * 
   * @returns {any}
   */
  getService (name) {
    return this._getService(name)
  }

  /**
   * Return an instance of a service
   * 
   * @param {string} name    Service name
   * @param {array}  parents Array of parents services
   * 
   * @private
   * @returns {any}
   */
  _getService (name, parents = []) {
    if (this._instances[name] === undefined) {
      this._instances[name] = this._createServiceInstance(name, parents)
    }

    return this._instances[name]
  }

  /**
   * Create an instance of a service
   * 
   * @param {string} name    Service name
   * @param {array}  parents Array of parents services
   * 
   * @private
   * @returns {any}
   */
  _createServiceInstance (name, parents = []) {
    if (this._serviceDefs[name] === undefined)
      throw new Error(`Container: unknow service ${name}.`)

    parents.push(name)

    const serviceDef = this._serviceDefs[name]
    let instance
    let dependencies = []
    if (serviceDef.dependencies && serviceDef.dependencies.length) {
      dependencies = this._getServiceDependencies(serviceDef, parents)
    }

    const args = [this.app]

    args.push(...dependencies)

    this.app.debug(`Container: create service instance ${name}.`)

    // If the service is a class
    if (/^class\s/.test(Function.prototype.toString.call(serviceDef.service))) {
      const Class = serviceDef.service
      instance = new Class(...args)
    } else {
      instance = serviceDef.service(...args)
    }

    return instance
  }

  /**
   * Retrun an array of dependencies instance
   * 
   * @param {string} serviceDef Parent service name
   * @param {array}  parents    Array of parents services
   * 
   * @private
   * @returns {Array<any>}
   */
  _getServiceDependencies (serviceDef, parents) {
    const depependencies = []
    for (const dependency of serviceDef.dependencies) {

      let type = serviceDef.dependenciesType
      let name
      if (isObject(dependency)) {
        type = dependency.type
        name = dependency.name
      } else if (typeof dependency === 'string') {
        name = dependency
      }

      if (parents.indexOf(name) !== -1) {
        throw new Error(
          `Circular dependency in service ${serviceDef.name}, ${name} already depend on ${serviceDef.name} (${[...parents, name].join('->')})!`
        )
      }

      depependencies.push(this._getService(name, JSON.parse(JSON.stringify(parents))))
    }

    return depependencies
  }
}

