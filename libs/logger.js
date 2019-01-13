const winston = require('winston')
require('winston-daily-rotate-file')
const path = require('path')
const utils = require('@midgar/utils')
const { format } = require('winston')
const { combine, timestamp, label } = format;

/**
 * Winston output log format
 * @param {*} options 
 */
function logFormat(json) {
  //text format
  const formatMessage = log => {
    return log.timestamp + '  [' + log.level + ']' + log.message
  }
  //error with stack format
  const formatError = log => `${log.timestamp} ${log.stack}`

  //check if error or text
  const msg = log => {
    if (log.stack) {
      return formatError(log)
    } else if (utils.isObject(log.message) || Array.isArray(log.message)) {
      log.message = JSON.stringify(log.message, null, "  ") 
      return formatMessage(log)
    } else {
      return formatMessage(log)
    }
  }
  //return json if enable or text
  if (json)
    return combine(format.json(), timestamp(), format.printf(msg))
  else 
    return combine(timestamp(), format.printf(msg))
}

//format stdout log
function logStdoutFormat() {
  const formatMessage = log => `${log.timestamp} [${log.level}] ${log.message}`
  const formatError = log => `${log.timestamp} [${log.level}]  ${log.stack}\n`
  //check if error or text
  const msg = (log) => {
    if (log.stack) {
      return formatError(log)
    } else if (utils.isObject(log.message) || Array.isArray(log.message)) {
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
 */
class Logger {
  constructor(options) {
    this.options = Object.assign({
      stdout: true,
      files: [{
          name: 'debug.log',
          level: 'debug'
        },
        {
          name: 'info.log',
          level: 'info'
        },
        {
          name: 'warning.log',
          level: 'warn'
        },
        {
          name: 'error.log',
          level: 'error'
        }
      ]
    }, options)
  }

  /**
   * Init logger
   */
  async init() {
    return utils.asyncMap(this.options.files, file => {
      return this._getFileTransport(file).catch(error => {
        console.log(error);
      }) 
    }).then(async transports => {
      //stdout
      if (this.options.stdout) {
        transports.push(new winston.transports.Console({
          format: logStdoutFormat(),
        }))
      }
      
      //create winston instance
      this.winston = winston.createLogger({
        level: this.options.level,
        transports: transports,
        exitOnError: false
      })

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
          this._exit, exit = true
        }

        //log file cannot be acces
        if (error.code == 'EACCES') {
          error = 'permission denied on log file: ' + error.path
        }

        if (exit) {
          throw new Error(error)
        } else {
          this.error(new Error(error))
        }
      })
    })
  }

  /**
   * Create a DailyRotateFile transport instance
   */
  async _getFileTransport(file) {
    const opts = {
      filename: file.name,
      level: file.level,
      dirname: this.options.dir,
      format: logFormat(this.options.json),
    }

    if (this.options.compress) {
      opts.zippedArchive = true
    } else if (this.options.compress === undefined) {
      opts.zippedArchive = true
    }

    if (this.options.maxSize) {
      opts.maxSize = this.options.maxSize
    } else if (this.options.maxSize === undefined) {
      opts.maxSize = '10m'
    }

    if (this.options.archiveTime) {
      opts.maxFiles = this.options.archiveTime
    } else if (this.options.archiveTime === undefined) {
      opts.maxFiles = '1d'
    }

    return new (winston.transports.DailyRotateFile)(opts)
  }

  /**
   * log a message
   * @param {*} level 
   * @param {*} msg 
   */
  async log (level, msg) {
    const log = {level: level }
    if (msg instanceof Error) {
      log.stack = msg.stack
      log.message = msg.message
    } else {
      log.message = msg
    }
    this.winston.log(log)
  }

  /**
   * log an error message or an Error
   * @param {*} msg 
   */
  async error(msg) {
    this.log('error', msg)
  }

  async warn(msg) {
    this.log('warn', msg)
  }

  async info(msg) {
    this.log('info', msg)
  }

  async verbose(msg) {
    this.log('verbose', msg)
  }

  async debug(msg) {
    this.log('debug', msg)
  }

  async silly(msg) {
    this.log('silly', msg)
  }
  
  async _waitWinston(wait, interval) {
    wait -= interval
    if (this.winston.transports.length && wait > 0) {
      console.log(this.winston.transports.length)
      console.log(wait / 1000)
      return await this._wait(interval).then(() => {
        return this._waitWinston(wait, interval)
      })
    } else {
      return
    }
  }

  _wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async exit() {
    //wait time in mili second
    const wait = 5000
    const interval = 200
    this.winston.end()
    if (this.winston.transports.length) {
      console.log('Wait 5 seconds max for log thank you')
      return await this._waitWinston(wait, interval)
    }
    this.winston.end()
  }
}

module.exports = Logger