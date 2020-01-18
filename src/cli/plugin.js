import path from 'path'
import inquirer from 'inquirer'
import utils from '@midgar/utils'
import camelCase from 'camelcase'

const resolve = (p) => {
  return path.join(__dirname, p)
}

// Plugin template path
const pluginTplPath = resolve('../../templates/plugin')

const nameQuestion = {
  type: 'input',
  name: 'pluginName',
  message: 'Plugin name ?',
  validate: (value) => {
    if (!value.match(/^(?=.{1,214}$)(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/i)) return 'Please enter a valid name !'
    return true
  }
}

/**
 * Creae new local plugin from plugin template
 *
 * @param {Midgar} mid Midgar instance
 *
 * @return {Promise<void>}
 * @private
 */
async function newPlugin (mid, pluginName) {
  // Ask plugin name
  if (!pluginName) {
    const answers = await inquirer.prompt([nameQuestion])
    pluginName = answers.pluginName
  }

  // Local plugin path
  const pluginPath = path.join(mid.pm.localPath, pluginName)

  // Check if plugin already exists
  const exists = await utils.asyncFileExists(pluginPath)
  if (exists) throw new Error(`Directory ${pluginPath} already exists !`)

  try {
    // Create plugin directory
    await utils.asyncMkdir(pluginPath, { recursive: true })
    console.log(`Create directory: ${pluginPath}.`)
  } catch (error) {
    if (error.code === 'EACCES') throw new Error(`Error: cannot create directory ${pluginPath} due to file permission !`)
    throw new Error(`Error: cannot create directory ${pluginPath}.`)
  }

  // Check if the directory is writable
  const isWrittable = await utils.asyncIsWritable(pluginPath)
  if (!isWrittable) throw new Error(`The directory ${pluginPath} is not writable.`)

  const pluginClass = getPluginClassName(pluginName)
  await mid.cli.copyTemplate(pluginPath, pluginTplPath, { pluginName, pluginClass })

  // Add local dependency
  await updatePackageJson(mid, pluginName, pluginPath)
}

/**
 * Add local dependency to package.json
 *
 * @param {Midgar} mid        Midgar instance
 * @param {string} pluginName Plugin name
 * @param {string} pluginPath Plugin path
 * @private
 */
async function updatePackageJson (mid, pluginName, pluginPath) {
  if (mid.cli.packagePath) {
    const { default: projectPkg } = await import(mid.cli.packagePath)
    if (!projectPkg.dependencies || !projectPkg.dependencies[pluginName]) {
      // Add local dependency
      const relativePluginPath = path.relative(path.dirname(mid.cli.packagePath), pluginPath)
      projectPkg.dependencies[pluginName] = 'file:' + relativePluginPath
      await utils.asyncWriteFile(mid.cli.packagePath, JSON.stringify(projectPkg, null, 4))
      console.log(`Local dependency: ${relativePluginPath} added to package.json, run npm update to update project dependencies.`)
    }
  }
}

/**
 * Générate plugin class name from a plugin name
 *
 * @param {string} pluginName Plugin name
 *
 * @return {string}
 * @private
 */
function getPluginClassName (pluginName) {
  let name = ''
  // If name have a namespace, remove it from class name
  if (pluginName.indexOf('/') !== -1) {
    const parts = pluginName.split('/')
    name = parts[1]
  } else {
    name = pluginName
  }

  // Set first letter upper
  return camelCase(name, { pascalCase: true }) + 'Plugin'
}

export {
  getPluginClassName
}

/**
 * Cli Module
 */
export default [
  // add command
  {
    command: 'add <plugin>',
    description: 'Add plugin',
    action: async (mid, plugin) => {
      if (!mid.cli.configPath) {
        console.log(`Cannot add ${plugin} to plugins.json, Midgar config have not be resolved !`)
      } else if (await mid.addPlugin(plugin)) {
        console.log(plugin + ' added to plugins.json !')
      }
    }
  },
  // rm command
  {
    command: 'rm <plugin>',
    description: 'Remove plugin',
    action: async (mid, plugin) => {
      if (await mid.removePlugin(plugin)) console.log(plugin + ' removed from plugins.json !')
    }
  },
  // enable command
  {
    command: 'enable <plugin>',
    description: 'Enable plugin',
    action: async (mid, plugin) => {
      if (await mid.enablePlugin(plugin)) console.log(plugin + ' enabled in plugins.json !')
    }
  },
  // disable command
  {
    command: 'disable <plugin>',
    description: 'Disable plugin',
    action: async (mid, plugin) => {
      if (await mid.disablePlugin(plugin)) console.log(plugin + ' disabled in plugins.json !')
    }
  },
  // new command
  {
    command: 'new [name]',
    description: 'New local plugin',
    action: async (mid, name) => {
      if (!mid.cli.configPath) throw new Error('Midgar config was not found !')
      await newPlugin(mid, name)
    }
  }
]
