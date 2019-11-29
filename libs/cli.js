const path = require('path')
const commander = require('commander')
const colors = require('colors/safe')
const utils = require('@midgar/utils')
const Midgar = require('../midgar')
const initCmds = require('../cli/init')

/**
 * Manage the Commander program
 */
class Cli {
  /**
   * Construct
   * 
   * init vars, create program and Midgar instance
   */
  constructor(argv) {
    this.rcConfig = null
    // Path of the config dir
    this.configPath = null

    this.argv = argv ? argv : process.argv
    this.program = new commander.Command()
    this.program.version('0.0.1')
      // Config dir path
      .option('-c, --config <path>', 'Config directory path')

      /**
       * Invalid command handler
       */
      .on('command:*', () => {
        if (this.configPath == null) {
          console.log('No config path found !')
        } else {
          console.log('Invalid command: %s\nSee --help for a list of available commands.', this.program.args.join(' '))
        }
        process.exit(1)
      })
    
    this.midgar = new Midgar
  }

  /**
   * Get the config path, init midgard 
   * and load plugins commands
   */
  async init() {
    const rcConfig = await this._loadRCFile()

    // If config path is in the rc config
    if (rcConfig && rcConfig.configPath) {
      this.configPath = rcConfig.configPath
    }

    // Parse options to get config dir path
    this.program.parseOptions(this.program.normalize(this.argv.slice(2)))
    // If option config is set the config path
    if (this.program.config && this.program.config.trim()) {
      this.configPath = this.program.config.trim()
    }

    this.addCommands(initCmds)

    if (this.configPath) {
      // Init midgar and load plugin cli commands
      await this.midgar.init(this.configPath)
      // Add cli plugin dir
      this.midgar.pm.pluginDirs['cli'] = 'cli'

      await this.loadPluginsCommands()
    }
  }

  /**
   * Load .midgarrc file and return his content
   * Return null if no rc file is found
   * 
   * @return {Object | null}
   */
  async _loadRCFile() {
    let rcFile = path.resolve(process.cwd(), '.midgarrc')
    let exists = await utils.asyncFileExists(rcFile)
    if (exists) {
      return utils.asyncRequire(rcFile)
    }
    
    if (!process.env.INIT_CWD)
      return null

    rcFile = path.resolve(process.env.INIT_CWD, '.midgarrc')
    exists = await utils.asyncFileExists(rcFile)
    if (exists) {
      return utils.asyncRequire(rcFile)
    }

    return null
  }

  /**
   * List commands and add them to the program
   * 
   * @param {Array} commands Array of comamnd Object
   */
  addCommands(commands) {
    for(let i = 0; i < commands.length;i++) {
      this.addCommand(commands[i])
    }
  }

  /**
   * Add a command to the program
   * 
   * @param {Object} command Command Object
   */
  addCommand(command) {
    this.program.command(command.command)
      .description(command.description)
      .action((...args) => {
        command.action(args, this.midgar).then(() => {
          this.exit(0)
        }).catch(error => {
          console.error(error)
          this.exit(1)
        })
      })
  }

  /**
   * Exit function
   * 
   * @param {Binary} code exit code 
   */
  exit(code) {
    process.exit(code)
  }

  /**
   * Get all plugins cli files and add commands
   */
  async loadPluginsCommands() {
    // Get cli files content
    const files = await this.midgar.pm.requireFiles('cli')
    for (let i = 0; i < files.length;i++) {
      this.addCommands(files[i].export)
    }
  }

  /**
   * Parse argv and run command
   */
  run() {
    this.program.parse(this.argv)
  }
}

module.exports = Cli