
import path from 'path'
import commander from 'commander'
import utils from '@midgar/utils'
import Midgar from '../midgar'
import initCmds from '../cli/init'
import pluginCmds from '../cli/plugin'

/**
 * Manage the Commander program
 * @class
 */
class Cli {
  /**
   * Construct
   * init vars, create program and Midgar instance
   */
  constructor (argv) {
    this.rcConfig = null
    // Path of the config dir
    this.configPath = null

    this.argv = argv
    this.mid = new Midgar()
    this.mid.cli = this
    this._runPromise = new Promise((resolve, reject) => {
      this._resolveRun = resolve
      this._rejectRun = reject
    })

    this.program = new commander.Command()
    this.program.version('0.0.1')
      // Config dir path
      .option('-c, --config <path>', 'Config directory path')

      /**
       * Invalid command handler
       */
      .on('command:*', () => {
        if (this.configPath !== null) throw new Error(`Invalid command: ${this.program.args.join(' ')}\nSee --help for a list of available commands.`)
        this._resolveRun({})
      })
  }

  /**
   * Get the config path, init midgard
   * and load plugins commands
   */
  async init () {
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
    this.addCommands(pluginCmds)

    if (this.configPath) {
      // Init midgar and load plugin cli commands
      await this.mid.init(this.configPath)
      // Add cli plugin dir
      this.mid.pm.pluginDirs.cli = 'cli'

      await this.loadPluginsCommands()
    }
  }

  /**
   * Load .midgarrc file and return his content
   * Return null if no rc file is found
   *
   * @return {Object|null}
   * @private
   */
  async _loadRCFile () {
    let rcFile = path.resolve(process.cwd(), '.midrc')
    let exists = await utils.asyncFileExists(rcFile)
    if (exists) {
      return utils.asyncRequire(rcFile)
    }

    if (!process.env.INIT_CWD) { return null }

    rcFile = path.resolve(process.env.INIT_CWD, '.midrc')
    exists = await utils.asyncFileExists(rcFile)
    if (exists) {
      return utils.asyncRequire(rcFile)
    }

    return null
  }

  /**
   * Add commands to commander program
   *
   * @param {Array} commands Array of comamnd Object
   */
  addCommands (commands) {
    for (let i = 0; i < commands.length; i++) {
      this.addCommand(commands[i])
    }
  }

  /**
   * Add a command to the program
   *
   * @param {Object} command Command Object
   */
  addCommand (command) {
    const cmd = this.program.command(command.command)
      .description(command.description)

    if (command.options) this._addCommandOptions(cmd, command.options)

    cmd.action((...args) => {
      command.action(this.mid, ...args).then((result) => {
        this._resolveRun(result)
      }).catch(error => {
        this._rejectRun(error)
      })
    })
  }

  /**
   * Add Option to a commander command
   *
   * @param {Command} cmd     Commander command
   * @param {Array}   options Command options
   * @private
   */
  _addCommandOptions (cmd, options) {
    // check options type
    if (!Array.isArray(options)) throw new TypeError('@midgar/midgar: Invalid cli options type !')

    for (const option of options) {
      // Check option def
      if (!option.flags || !option.description) throw new Error('@midgar/midgar: Invalid cli option def !')

      const args = [
        option.flags,
        option.description
      ]

      // Add processing arg if exist
      if (option.processing !== undefined) args.push(option.processing)
      // Add default arf if exist
      if (option.default !== undefined) args.push(option.default)

      console.log(...args)
      cmd.option(...args)
    }
  }

  /**
   * Get all plugins cli files and add commands
   */
  async loadPluginsCommands () {
    // Get cli files content
    const files = await this.mid.pm.importDir('cli')
    for (let i = 0; i < files.length; i++) {
      this.addCommands(files[i].export)
    }
  }

  /**
   * Parse argv and run command
   * Wait for action result promise
   * @return {Any}
   */
  run () {
    console.log('parse')
    this.program.parse(this.argv)
    return this._runPromise
  }
}

export default Cli
