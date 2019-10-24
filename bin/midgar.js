#!/usr/bin/env node

const path = require('path')
const fs = require('fs')
const commander = require('commander')
const colors = require('colors/safe')
const init = require('../libs/cli-init')


// Header
console.log(colors.cyan('midgar-cli'))
console.log('')

/**
 * Load .midgarrc file
 */
function loadRCFile() {
  let rcFile = path.resolve(process.cwd(), '.midgarrc')
  if (fs.existsSync(rcFile)) {
    return require(rcFile)
  }
  
  if (!process.env.INIT_CWD)
    return null

  rcFile = path.resolve(process.env.INIT_CWD, '.midgarrc')
  if (fs.existsSync(rcFile)) {
    return require(rcFile)
  }

  return null
}

const rcConfig = loadRCFile()

// Path of the config dir
let configPath = null

const Midgar = require('../midgar')
const midgar = new Midgar

// If config path is in the rc config
if (rcConfig && rcConfig.configPath) {
  configPath = rcConfig.configPath
}

const program = new commander.Command()
program.version('0.0.1')
  .option('-c, --config <path>', 'Config path')

  
// register cli
midgar.cli = program

/**
 * Midgar init command
 * Create the init project
 */
program.command('init [path]')
  .description('Create init project')
  .action((initPath) => {
    initPath = initPath ? path.resolve(process.cwd(), initPath) : process.cwd()
    
    init(initPath).then(() => {
      process.exit(1)
    }).catch((e) => {
      console.log(e)
      process.exit(0)
    })
  })


program.on('command:*', function () {
  console.log('Invalid command: %s\nSee --help for a list of available commands.')
  process.exit(1)
})

program.parseOptions(program.normalize(process.argv.slice(2)))

if (program.config.trim()) {
  configPath = program.config.trim()
}

if (configPath) {
  midgar.init(configPath).then(() => {
    program.parse(process.argv)
  })
} else {
  program.parse(process.argv)
}
