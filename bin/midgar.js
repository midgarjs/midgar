#!/usr/bin/env node

const figlet = require('figlet')
const path = require('path')
const colors = require('colors/safe');
const fs = require('fs')
const yargs = require('yargs')
const init = require('../libs/cli-init')

if (!yargs.argv.nh) {
  console.log(colors.cyan(figlet.textSync("midgar-cli", {
    font: "Star Wars",
    horizontalLayout: "default",
    verticalLayout: "default"
  })))
  
  console.log('')
  console.log('')
}

yargs.command('init [path]', 'start the server', {}, (argv) => {
  const initPath = argv.path ? path.resolve(process.cwd(), argv.path) : process.cwd()
  init(initPath).then(() => {
    process.exit(1)
  }).catch((e) => {
    console.log(e)
    process.exit(0)
  })
})

const Midgar = require('@midgar/midgar')             
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

const config = loadRCFile()
let configPath = null
if (config != null && config.configPath) {
  configPath = config.configPath
} else if (fs.existsSync(path.resolve(process.cwd(), 'config'))) {
  configPath = path.resolve(process.cwd(), 'config')
} else if (process.env.INIT_CWD && fs.existsSync(path.resolve(process.env.INIT_CWD, 'config'))) {
  configPath = path.resolve(process.env.INIT_CWD, 'config')
}

if (configPath != null) {
  const midgar = new Midgar
  //init midgar and register cli service
  midgar.loadConfig(configPath).then(() => {
    midgar.cli = yargs
    midgar.init().then(() => {
      try {
        yargs.argv
      } catch (e) {
        console.log(e)
        process.exit(1)
      }
    })
  })
} else {
  try {
    yargs.argv
  } catch (e) {
    console.log(e)
    process.exit(1)
  }
}