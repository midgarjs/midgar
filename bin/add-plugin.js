#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const Midgar = require('../midgar') 

const [,, ...args] = process.argv

// check if the plugin is def
if (!args[0]) {
  throw new Error('No plugin name')
}

const plugin = args[0]

function loadRCFile() {
  let rcFile = path.resolve(process.cwd(), '.midgarrc')
  if (fs.existsSync(rcFile)) {
    return require(rcFile)
  }
  
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
} else if (fs.existsSync(path.resolve(process.env.INIT_CWD, 'config'))) {
  configPath = path.resolve(process.env.INIT_CWD, 'config')
}

if (configPath != null) {
  const midgar = new Midgar
  //init midgar and register cli service
  midgar.loadConfig(configPath).then(async () => {
    await midgar.addPlugin(plugin)
    process.exit()
  })
} else {
  constole.log('Cannot found midgar config dir. plugin no\'t added to the plugin config file.')
}
