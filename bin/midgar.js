#!/usr/bin/env node

const colors = require('colors/safe')
const Cli = require('../libs/cli')

// Header
console.log(colors.cyan('midgar-cli'))
console.log('')

const cli = new Cli
// Init cli then parse command and run
cli.init().then(() => {
  cli.program.parse(process.argv)
})