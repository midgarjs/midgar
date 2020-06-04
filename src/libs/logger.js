import winston, { format, error } from 'winston'
import utils from '@midgar/utils'
import 'winston-daily-rotate-file'

const { combine, timestamp } = format

/**
 * Winston output log format
 * @param {*} options
 * @private
 */
function logFormat(json) {
  // text format
  const formatMessage = (log) => {
    return log.timestamp + '  [' + log.level + ']' + log.message
  }
  // check if error or text
  const msg = (log) => {
    if (log.stack) {
      return `${log.timestamp} ${log.stack}`
    } else if (utils.isObject(log.message) || Array.isArray(log.message)) {
      log.message = JSON.stringify(log.message, null, '  ')
      return formatMessage(log)
    } else {
      return formatMessage(log)
    }
  }
  // return json if enable or text
  if (json) {
    return combine(format.json(), timestamp(), format.printf(msg))
  } else {
    return combine(timestamp(), format.printf(msg))
  }
}
function addZero(x, n) {
  while (x.toString().length < n) {
    x = '0' + x
  }
  return x
}
/**
 * format stdout log
 * @private
 */
function logStdoutFormat() {
  const formatMessage = (log) => {
    const date = new Date(log.timestamp)
    const time = `${addZero(date.getHours(), 2)}:${addZero(date.getMinutes(), 2)}:${addZero(
      date.getSeconds(),
      2
    )}  ${addZero(date.getMilliseconds(), 3)}`

    return `${time} [${log.level}] ${log.message}`
  }
  // check if error or text
  const msg = (log) => {
    if (log.stack) {
      return `${log.timestamp} [${log.level}]  ${log.stack}\n`
    } else if (utils.isObject(log.message) || Array.isArray(log.message)) {
      log.message = JSON.stringify(log.message, null, '  ')
      return formatMessage(log)
    } else {
      return formatMessage(log)
    }
  }

  return combine(format.colorize(), timestamp(), format.printf(msg))
}

/**
 * Logger class
 * @class
 */
class Logger {
  constructor(options) {
    this.options = Object.assign(
      {
        stdout: false,
        files: [
          {
            filename: 'midgar-%DATE%.log',
            datePattern: 'YYYY-MM-DD-HH',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '14d'
          }
        ]
      },
      options
    )
  }

  /**
   * Init logger
   */
  async init() {
    const transports = this.options.files.map((file) => {
      return this._getFileTransport(file)
    })

    // create winston instance
    this.winston = winston.createLogger({
      level: this.options.level,
      transports: transports,
      exitOnError: false
    })

    // stdout
    if (this.options.stdout) {
      this.winston.add(
        new winston.transports.Console({
          format: logStdoutFormat()
        })
      )
    }

    /**
     * Error handler
     * Errors throw by winston are super Errors
     * there cannot be catch and cause an uncaught exception
     * and finaly cause a process.exit() this exception is catch
     * by midgar but ....
     *
     * @todo: investigate on the fact to throw all exception
     */
    this.winston.on('error', (error) => {
      let exit = false
      if (!this._exit) {
        this._exit = true
        exit = true
      }

      // log file cannot be acces
      if (error.code === 'EACCES') {
        error = 'permission denied on log file: ' + error.path
      }

      if (exit) {
        throw new Error(error)
      } else {
        this.error(new Error(error))
      }
    })
  }

  /**
   * Create a DailyRotateFile transport instance
   * @private
   */
  _getFileTransport(file) {
    file.dirname = this.options.dir
    file.format = logFormat(this.options.json)
    return new winston.transports.DailyRotateFile(file)
  }

  /**
   * log a message
   * @param {*} level
   * @param {*} msg
   */
  async log(level, ...msgs) {
    for (const msg of msgs) {
      const log = { level: level }
      if (msg instanceof Error) {
        log.stack = msg.stack
        log.message = msg.message
      } else {
        log.message = msg
      }
      this.winston.log(log)
    }
  }

  /**
   * log an error message or an Error
   * @param {*} msg
   */
  async error(...msgs) {
    this.log(...['error', ...msgs])
  }
  async warn(...msgs) {
    this.log(...['warn', ...msgs])
  }
  async info(...msgs) {
    this.log(...['info', ...msgs])
  }
  async verbose(...msgs) {
    this.log(...['verbose', ...msgs])
  }
  async debug(...msgs) {
    this.log(...['debug', ...msgs])
  }

  async silly(...msgs) {
    this.log(...['silly', ...msgs])
  }

  async _waitWinston(wait, interval) {
    wait -= interval
    if (this.winston.transports.length && wait > 0) {
      // console.log(this.winston.transports.length)
      // console.log(wait / 1000)
      await this._wait(interval)
      return this._waitWinston(wait, interval)
    }
  }

  _wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  async exit() {
    // wait time in mili second
    const wait = 5000
    const interval = 200
    this.winston.end()
    if (this.winston.transports.length) {
      await this._waitWinston(wait, interval)
    }
  }
}

export default Logger
