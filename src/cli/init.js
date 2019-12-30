import utils from '@midgar/utils'
import path from 'path'

const resolve = (p) => {
  return path.join(__dirname, p)
}

const tplPath = resolve('./.init-tpl')

/**
 * Copy template directory
 * @param {String} projectPath Project init path
 * @param {String} templatePath Template path
 * @param {Object} result Command result object
 * @return {Object}
 * @private
 */
async function initDir (projectPath, templatePath, result) {
  const stats = await utils.asyncReaddir(templatePath)
  await utils.asyncMap(stats, async (file) => {
    const projectFilePath = path.join(projectPath, file)
    const tplFilePath = path.join(templatePath, file)

    const fileStats = await utils.asyncStat(tplFilePath)
    if (fileStats.isFile()) {
      const content = await utils.asyncReadFile(tplFilePath, 'utf8')
      await utils.asyncWriteFile(projectFilePath, content, 'utf-8')
      result.stdout.push('Create file: ' + projectFilePath)
    } else if (fileStats.isDirectory()) {
      await utils.asyncMkdir(projectFilePath)
      result.stdout.push('Create directory: ' + projectFilePath)
      await initDir(projectFilePath, tplFilePath, result)
    }
  })

  return result
}

/**
 * Init Midgar project into direction projectPath
 * @param {String} projectPath Init project path
 * @return {Object} Cli restult object
 * @private
 */
async function init (projectPath) {
  const result = {
    stdout: []
  }
  // Check if the directory exist
  const exist = await utils.asyncFileExists(projectPath)
  if (!exist) {
    // Try to create him if not exist
    try {
      await utils.asyncMkdir(projectPath, { recursive: true })
      result.stdout.push('Create directory: ' + projectPath)
    } catch (error) {
      if (error.code === 'EACCES') {
        throw new Error('Cannot create directory ' + projectPath + ' due to file permission')
      } else {
        throw new Error('Cannot create directory ' + projectPath)
      }
    }
  }

  // Check if the directory is writable
  const isWrittable = await utils.asyncIsWritable(projectPath)
  if (!isWrittable) {
    throw new Error('The directory ' + projectPath + ' is not writable')
  }

  // Check if the directory is empty
  const stats = await utils.asyncReaddir(projectPath)
  if (stats.length) {
    throw new Error('The directory ' + projectPath + ' is not empty')
  }

  await initDir(projectPath, tplPath, result)
  return result
}

export default [
  {
    command: 'init [path]',
    description: 'Create init project',
    action: async (mid, initPath) => {
      initPath = initPath ? path.resolve(process.cwd(), initPath) : process.cwd()

      return init(initPath)
    }
  }
]
