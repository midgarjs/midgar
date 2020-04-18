import path from 'path'
import commander from 'commander'
import { cosmiconfig } from 'cosmiconfig'
import template from 'lodash.template'
import utils from '@midgar/utils'

import Midgar from '../midgar'
import pluginCmds from '../cli/plugin'
import initCmds from '../cli/init'

/**
 * @typedef {Object} Command
 * @property {string}               command   Command pattern
 * @property {string}               description   Command description
 * @property {Array<CommandOption>} options Command options array
 * @property {function}             action   Action function
 */

/**
 * @typedef {Object} Command
 * @property {string} flags       Option flags string
 * @property {string} description Option description
 */

/**
 * Manage the Commander program
 * @class
 */
class Cli {
  /**
   * @param {Array}  argv   Cli command arguments
   * @param {string} cwd    Current working directory path
   * @param {Stream} stdin  Input stream
   * @param {Stream} stdout Output stream
   */
  constructor(argv, cwd, stdin = process.stdin, stdout = process.stdout) {
    /**
     * Midgar config path
     * @type {string}
     */
    this.configPath = null

    /**
     * Package.json of Midgar app
     */
    this.packagePath = null

    /**
     * Cli command arguments
     * @type {Array}
     */
    this.argv = argv

    /**
     * Input stream
     * @type {Stream}
     */
    this.stdin = stdin

    /**
     * Output stream
     * @type {Stream}
     */
    this.stdout = stdout

    /**
     * Current working directory
     * @type {String}
     */
    this.cwd = cwd

    /**
     * Midgar instance
     * @type {Midgar}
     */
    this.mid = new Midgar()

    // Set Cli instance on midgar
    this.mid.cli = this

    /**
     * Run method promise
     * Resolve and reject function are binded on CLi instance
     * @type {Promise<any>}
     * @private
     */
    this._runPromise = new Promise((resolve, reject) => {
      this._resolveRun = resolve
      this._rejectRun = reject
    })

    /**
     * Commander instance
     * @type {commander.Command}
     */
    this.program = new commander.Command()
    this.program.version('0.0.1')
      // Config dir path
      .option('-c, --config <path>', 'Config directory path')

      // Invalid command handler
      .on('command:*', () => {
        if (this.configPath !== null) this._rejectRun(`Invalid command: ${this.program.args.join(' ')}\nSee --help for a list of available commands.`)
        else this._rejectRun(`Invalid command: ${this.program.args.join(' ')}\n--config option is not set, see --help for a list of available commands.`)
      })
  }

  /**
   * Get the config path, init midgard
   * and load plugins commands
   */
  async init () {
    // Parse options to get config dir path
    this.program.parseOptions(this.argv.slice(2))
    // If option config is set the config path
    if (this.program.config && this.program.config.trim()) {
      this.configPath = this.program.config.trim()
    } else {
      await this._loadConfigAndPackagePath()
    }

    this.addCommands(initCmds)
    this.addCommands(pluginCmds)

    // Don't init Midgar for plugin command
    const command = this.argv[2]
    const skipedCommands = [
      'add',
      'rm',
      'enable',
      'disable'
    ]

    if (this.configPath && !skipedCommands.includes(command)) {
      // Init midgar and load plugin cli commands
      await this.mid.start(this.configPath)
      // Add cli plugin dir
      this.mid.pm.addModuleType('cli', 'cli')

      await this.loadPluginsCommands()
    } else if (this.configPath) {
      await this.mid.loadConfig(this.configPath)
    }
  }

  /**
   * Load .midgarrc file and return his content
   * Return null if no rc file is found
   *
   * @return {Object|null}
   * @private
   */
  async _loadConfigAndPackagePath () {
    const explorer = cosmiconfig('midgar', { searchPlaces: ['package.json'] })
    const result = await explorer.search(this.cwd)

    // If config path is in the rc config
    if (result) {
      const { filepath, config: midgarConfig } = result
      if (midgarConfig && midgarConfig.config) {
        if (typeof midgarConfig.config !== 'string') throw new TypeError('Invalid config path type !')
        this.configPath = path.resolve(path.dirname(filepath), midgarConfig.config)
        this.packagePath = filepath
      }
    }
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
   * @param {Command} command Command Object
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

      cmd.option(...args)
    }
  }

  /**
   * Get all plugins cli files and add commands
   */
  async loadPluginsCommands () {
    // Get cli files content
    const files = await this.mid.pm.importModules('cli')
    for (let i = 0; i < files.length; i++) {
      this.addCommands(files[i].export)
    }
  }

  /**
   * Copy template directory
   *
   * @param {string} targetPath Target copy path path
   * @param {string} templatePath Template path
   * @param {Object} variables Template variables
   *
   * @return {Promise<void>}
   * @private
   */
  async copyTemplate (targetPath, templatePath, variables = {}) {
    const stats = await utils.asyncReaddir(templatePath)
    for (const file of stats) {
      const filePath = path.join(targetPath, file)
      const tplFilePath = path.join(templatePath, file)

      const fileStats = await utils.asyncStat(tplFilePath)
      if (fileStats.isFile()) {
        let content = await utils.asyncReadFile(tplFilePath, 'utf8')
        const compiled = template(content)
        content = compiled(variables)
        await utils.asyncWriteFile(filePath, content, 'utf-8')
        console.log('Create file: ' + filePath)
      } else if (fileStats.isDirectory()) {
        await utils.asyncMkdir(filePath)
        console.log('Create directory: ' + filePath)
        await this.copyTemplate(filePath, tplFilePath, variables)
      }
    }
  }

  /**
   * Parse argv and run command
   * Wait for action result promise
   * @return {Any}
   */
  run () {
    this.program.parse(this.argv)
    return this._runPromise
  }
}

export default Cli
