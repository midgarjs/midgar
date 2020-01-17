/**
 * CustomLogger class
 */
export default class CustomLogger {
  constructor (options) {
    this.messages = {
      error: [],
      warn: [],
      info: [],
      verbose: [],
      debug: [],
      silly: []
    }
  }

  /**
   * Init logger
   */
  async init () {}

  /**
   * log a message
   * @param {*} level
   * @param {*} msg
   */
  async log (level, msg) {
    this.messages[level].push(msg)
  }

  /**
   * log an error message or an Error
   * @param {*} msg
   */
  async error (msg) {
    this.log('error', msg)
  }

  async warn (msg) {
    this.log('warn', msg)
  }

  async info (msg) {
    this.log('info', msg)
  }

  async verbose (msg) {
    this.log('verbose', msg)
  }

  async debug (msg) {
    this.log('debug', msg)
  }

  async silly (msg) {
    this.log('silly', msg)
  }

  async exit () {}
}
