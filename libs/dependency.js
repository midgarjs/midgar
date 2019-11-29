/**
 * Dependency class
 * 
 * Manage plugin dependency
 */
class Dependency {

  /**
   * 
   * @param {Array} plugins array of plugin name
   * @param {Object} dependencies object with plugin dependeny
   */
  constructor(plugins, dependencies) {
    this._plugins = plugins
    this._dependencies = dependencies
  }

  /**
   * Clone dependency Object
   * @param {*} deps 
   */
  _cloneDep(deps) {
    let o = {}
    for (const k in deps) {
      o[k] = Array.from(deps[k])
    }
    return o
  }

  /**
   * Get tree dep
   * 
   * i dont know what i can do with this but its cool
   */
  async getTree() {
    let dependencies = await this._cloneDep(this._dependencies)
    let plugins = Array.from(this._plugins)
    let tree = []
    let finish = false
    while(!finish && plugins.length) {
      finish = true
      for (let key = 0; key < plugins.length;key++) {
        const name = plugins[key]
        const deps = dependencies[name]
        //if plugin have dependencies
        if (deps && deps.length) {
          if (!tree.length) {
            continue
          }
          if (await this._checkDependenciesTree(name, dependencies, plugins, tree)) {
            finish = false
          }
        } else {
          //if no dependcies add the plugin on the root
          tree.push({name, children: []})
          plugins.splice(plugins.indexOf(name), 1)
          finish = false
        }
      }
    }

    return tree
  }

  /**
   * 
   * 
   * @param {*} name 
   */
  async _checkDependenciesTree(name, dependencies, plugins, tree) {
    
    //list plugin dependencies
    for (let key in dependencies[name]) {
      const depName = dependencies[name][key]
      //if dependency is added
      if (plugins.indexOf(depName) == -1) {
        //remove them
        dependencies[name].splice(dependencies[name].indexOf(depName), 1)
        //if plugin have no more dependency add it ti the tree
        if (!dependencies[name].length) {
          let item = await this._getLastTreeItem(name, tree)
          item.children.push({name, children: []})
          plugins.splice(plugins.indexOf(name), 1)
          return true
        } else {
          return await this._checkDependenciesTree(name, dependencies, plugins, tree)
        }
      }
    }
    return false
  }

  async _getLastTreeItem(name, tree) {
    let last = null
    for (const key in tree) {
      //is a dependeny
      if (this._dependencies[name].indexOf(tree[key].name ) !== -1) {
        last = tree[key]
      }
  
      if (tree[key].children.length) {
        let _last = await this._getLastTreeItem(name, tree[key].children)
        if (_last !== null) {
          last = _last
        }
      }
    }
    return last
  }

  /**
   * return an array of plugin names sorted by dependencies
   */
  async getSortedPlugins() {
    // Clone dependencies object
    let dependencies = this._cloneDep(this._dependencies)
    
    // Clone plugins array
    let plugins = Array.from(this._plugins)

    // Result array
    let sortedPlugins = []

    //stop if no plugin is added in the result array
    //or there are no more plugins
    while(plugins.length) {
      //list plugins
      for (let i = 0;i < plugins.length;i++) {
        const pluginName = plugins[i]

        // Get plugin dependencies
        const pluginDependencies = dependencies[pluginName]

        // If plugin have dependencies
        if (pluginDependencies && pluginDependencies.length) {

          // If result is empty continue while his dependencies is added to result
          if (!sortedPlugins.length) {
            continue
          }

          if (this._haveAllDep(sortedPlugins, pluginDependencies)) {
            sortedPlugins.push(pluginName)          
            plugins.splice(plugins.indexOf(pluginName), 1)
            i--
          }
        } else {
          // if no dependcies add the plugin
          sortedPlugins.push(pluginName)
          plugins.splice(plugins.indexOf(pluginName), 1)
          i--
        }
      }
    }

    return sortedPlugins
  }

  /**
   * Check if all dependencues in pluginDependencies are in the array sortedPlugins
   * 
   * @param {Array} sortedPlugins      Plugin names 
   * @param {Array} pluginDependencies Plugin dependencies names
   * 
   * @return {Boolean}
   */
  _haveAllDep(sortedPlugins, pluginDependencies) {
    let haveAllDep = true
    for (let di = 0;di < pluginDependencies.length;di++) {
      if (sortedPlugins.indexOf(pluginDependencies[di]) === -1) {
        haveAllDep = false
      }
    }

    return haveAllDep
  }

  /**
   * Renvoi false si un dependence est dans le tableau des plugin a precess
   * 
   * @param {String} pluginName   Plugin name
   * @param {Object} dependencies Contain all dependencies of all plugins
   * @param {Array}  plugins      Plugin names 
   */
  async _checkDependenciesOrder(pluginName, dependencies, plugins, result) {
    
    //list plugin dependencies
    for (let key in dependencies[pluginName]) {
      const depName = dependencies[pluginName][key]
      //if dependency is added
      if (result.indexOf(depName) !== -1) {
        //remove them
        dependencies[pluginName].splice(dependencies[pluginName].indexOf(depName), 1)
        //if plugin have no more dependency add it ti the result
        if (!dependencies[pluginName].length) {
          //add to result array
          result.push(pluginName)
          //remove the plugin
          plugins.splice(plugins.indexOf(pluginName), 1)
          return true
        } else {
          //reprocess the plugin
          return await this._checkDependenciesOrder(pluginName, dependencies, plugins, result)
        }
      }
    }
    return false
  }
}


module.exports = Dependency