const utils = require('@midgar/utils')
const fs = require('fs')
const path = require('path')

const resolve = (p) => {
  return path.join(__dirname, p)
}

const tplPath = resolve('../.init-tpl')

async function initDir(projectPath, tplPath) {
  // Check if the directory is empty
  const stats = await utils.asyncReaddir(tplPath)
  await utils.asyncMap(stats, async (file) => {
    const projectFilePath = path.join(projectPath, file)
    const tplFilePath = path.join(tplPath, file)

    const fileStats = await utils.asyncStat(tplFilePath)
    if (fileStats.isFile()) {
      const content = await utils.asyncReadFile(tplFilePath, 'utf8')
      await utils.asyncWriteFile(projectFilePath, content, 'utf-8')
      console.log('Create file: ' + projectFilePath)
    } else if (fileStats.isDirectory()) {
      await utils.asyncMkdir(projectFilePath)
      console.log('Create directory: ' + projectFilePath)
      await initDir(projectFilePath, tplFilePath)
    }
  })
}

module.exports = async (projectPath) => {
  // Check if the directory exist
  const exist = await utils.asyncFileExists(projectPath)
  if (!exist) {
    // Try to create him if not exist
    try {
      await utils.asyncMkdir(projectPath, { recursive: true })
      console.log('Create directory: ' + projectPath)
    } catch (error) {
      if (error.code == 'EACCES') {
        throw('Cannot create directory ' + projectPath + ' due to file permission')
      } else {
        throw('Cannot create directory ' + projectPath)
      }
    }
  }

  // Check if the directory is writable
  const isWrittable = await utils.asyncIsWritable(projectPath)
  if (!isWrittable) {
    throw('The directory ' + projectPath + ' is not writable')
  }

  // Check if the directory is empty
  const stats = await utils.asyncReaddir(projectPath)
  if (stats.length) {
    throw('The directory ' + projectPath + ' is not empty')
  }

  await initDir(projectPath, tplPath)
}