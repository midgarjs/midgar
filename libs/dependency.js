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
  async _cloneDep(deps) {
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
      for (let key = 0; key < plugins.length;i++) {
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
   * return an array of plugin name sorted with dependencies
   */
  async getOrder() {
    //clone dependencies object
    let dependencies = await this._cloneDep(this._dependencies)
    //clone plugins array
    let plugins = Array.from(this._plugins)

    //result array
    let result = []

    //set to false to let start
    let finish = false
    //stop if no plugin is added in the result array
    //or there are no more plugins
    while(!finish && plugins.length) {
      //init to true
      finish = true
  
      //list plugins
      for (const key in plugins) {
        const name = plugins[key]

        //plugin dependencies
        const deps = dependencies[name]

        //if plugin have dependencies
        if (deps && deps.length) {
          //if result is empty continue
          if (!result.length) {
            continue
          }


          if (await this._checkDependenciesOrder(name, dependencies, plugins, result)) {
            finish = false
          }
        } else {
          //if no dependcies add the plugin on the root
          result.push(name)
          plugins.splice(plugins.indexOf(name), 1)
          finish = false
        }
      }
    }

    return result
  }

  /**
   * Renvoi false si un dependance est dans le tableau des plugin a precess
   * 
   * @param {*} name 
   */
  async _checkDependenciesOrder(name, dependencies, plugins, result) {
    
    //list plugin dependencies
    for (let key in dependencies[name]) {
      const depName = dependencies[name][key]
      //if dependency is added
      if (result.indexOf(depName) !== -1) {
        //remove them
        dependencies[name].splice(dependencies[name].indexOf(depName), 1)
        //if plugin have no more dependency add it ti the result
        if (!dependencies[name].length) {
          //add to result array
          result.push(name)
          //remove the plugin
          plugins.splice(plugins.indexOf(name), 1)
          return true
        } else {
          //reprocess the plugin
          return await this._checkDependenciesOrder(name, dependencies, plugins, result)
        }
      }
    }
    return false
  }
}


module.exports = Dependency