import path from 'path'
import inquirer from 'inquirer'
import utils from '@midgar/utils'

const resolve = (p) => {
  return path.join(__dirname, p)
}

const projectTplPath = resolve('../../templates/project')

/**
 * Init Midgar project into direction projectPath
 *
 * @param {string} projectPath Init project path
 * @return {object} Cli restult object
 * @returns {Promise<void>}
 *
 * @private
 */
async function init (mid, projectPath) {
  // Check if the directory exist
  const exists = await utils.asyncFileExists(projectPath)

  if (exists) {
    // Check if the directory is empty
    const stats = await utils.asyncReaddir(projectPath)
    if (stats.length) throw new Error(`The directory ${projectPath} is not empty !`)
  } else {
    // Try to create dir if not exists
    try {
      await utils.asyncMkdir(projectPath, { recursive: true })
      console.log(`Create directory: ${projectPath}.`)
    } catch (error) {
      if (error.code === 'EACCES') throw new Error(`Error: cannot create directory ${projectPath} due to file permission !`)
      throw new Error(`Error: cannot create directory ${projectPath}.`)
    }
  }

  // Check if the directory is writable
  const isWrittable = await utils.asyncIsWritable(projectPath)
  if (!isWrittable) throw new Error(`The directory ${projectPath} is not writable.`)
  const question = {
    type: 'input',
    name: 'projectName',
    message: 'Project name ?',
    validate: async (value) => {
      if (!value.match(/^(?=.{1,214}$)(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/i)) return 'Please enter a valid name !'
      return true
    }
  }

  const { projectName } = await inquirer.prompt([question])
  await mid.cli.copyTemplate(projectPath, projectTplPath, { projectName })
}

export default [
  {
    command: 'init [path]',
    description: 'Create new project',
    action: (mid, initPath) => {
      initPath = initPath ? path.resolve(process.cwd(), initPath) : process.cwd()

      return init(mid, initPath)
    }
  }
]
