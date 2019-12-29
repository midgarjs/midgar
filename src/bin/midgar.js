#!/usr/bin/env node

const esmRequire = require('esm')(module)

const colors = esmRequire('colors/safe')
const { default: Cli } = esmRequire('../libs/cli')

// Header
console.log(colors.cyan('#midgar-cli'))

const cli = new Cli(process.argv)
// Init cli then parse command and run
cli.init().then(async () => {
  try {
    const result = await cli.run()
    if (result.stdout) console.log(result.stdout)
    process.exit(0)
  } catch (error) {
    console.log(error)
    process.exit(1)
  }
})
