const winston = require('winston')
/// const DailyRotateFile = require('winston-daily-rotate-file')

const utils = require('./utils')

const { combine, timestamp } = winston.format

/**
 * Winston output log format
 * @param {*} options
 * @private
 */
function logFormat (json) {
    // text format
    const formatMessage = (log) => {
        return `${log.timestamp} [${log.level}] ${log.message}`
    }
    // check if error or text
    const msg = (log) => {
        if (log.stack) {
            return `${log.timestamp} [${log.level}] ${log.message}\n${log.stack}`
        } else if (utils.isObject(log.message) || Array.isArray(log.message)) {
            log.message = JSON.stringify(log.message, null, '  ')
            return formatMessage(log)
        } else {
            return formatMessage(log)
        }
    }
    // return json if enable or text
    if (json) {
        // return combine(winston.format.json(), timestamp(), winston.format.printf(msg))
    } else {
        return combine(timestamp(), winston.format.printf(msg))
    }
}

function addZero (x, n) {
    while (x.toString().length < n) {
        x = '0' + x
    }
    return x
}
/**
 * format stdout log
 * @private
 */
function logStdoutFormat () {
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
            return `${log.timestamp} [${log.level}] ${log.message}\n${log.stack}`
        } else if (utils.isObject(log.message) || Array.isArray(log.message)) {
            log.message = JSON.stringify(log.message, null, '  ')
            return formatMessage(log)
        } else {
            return formatMessage(log)
        }
    }

    return combine(winston.format.colorize(), timestamp(), winston.format.printf(msg))
}

/**
 * Logger class
 * @class
 */
class Logger {
    constructor (options) {
        this.options = Object.assign(
            {
                stdout: true,
                files: [
                    /*{
                        filename: 'midgar-%DATE%.log',
                        datePattern: 'YYYY-MM-DD-HH',
                        zippedArchive: true,
                        maxSize: '20m',
                        maxFiles: '14d'
                    }*/
                ]
            },
            options
        )
        this._init()
    }

    /**
     * Init logger
     */
    _init () {

        if (this.options.files && this.options.files.length && !this.options.dir)
            throw new Error('Logger: Missing dir in logger config !')

        const transports = this.options.transports ? this.options.transports : []
        transports.push(...this.options.files.map((file) => {
            return this._getFileTransport(file)
        }))

        // create winston instance
        this.winston = winston.createLogger({
            level: this.options.level,
            transports,
            //    exitOnError: true
        })

        // stdout
        if (this.options.stdout) {
            this.winston.add(
                new winston.transports.Console({
                    format: logStdoutFormat()
                })
            )
        }

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
     * Create a File transport instance
     * @private
     */
    _getFileTransport (file) {
        file.dirname = this.options.dir
        file.format = file.format ? file.format : logFormat(this.options.json)
        return new winston.transports.File(file)
    }

    /**
     * log a message
     * 
     * @param {string} level Log level
     * @param {string} msg   Message
     * 
     * @return {Promise<void>}
     */
    async log (level, ...msgs) {
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
     * Log an error  message
     * 
     * @param  {...any} args
     * 
     * @return {Promise<void>}
     */
    async error (...msgs) {
        return this.log(...['error', ...msgs])
    }

    /**
     * Log a warning message
     * 
     * @param  {...any} args
     * 
     * @return {Promise<void>}
     */
    async warn (...msgs) {
        return this.log(...['warn', ...msgs])
    }

    /**
     * Log an info  message
     * 
     * @param  {...any} args
     * 
     * @return {Promise<void>}
     */
    async info (...msgs) {
        return this.log(...['info', ...msgs])
    }

    /**
     * Log a verbose message
     * 
     * @param  {...any} args
     * 
     * @return {Promise<void>}
     */
    async verbose (...msgs) {
        return this.log(...['verbose', ...msgs])
    }

    /**
     * Log a debug message
     * 
     * @param  {...any} args
     * 
     * @return {Promise<void>}
     */
    async debug (...msgs) {
        return this.log(...['debug', ...msgs])
    }

    /**
     * Log a silly message
     * 
     * @param  {...any} args
     * 
     * @return {Promise<void>}
     */
    async silly (...msgs) {
        return this.log(...['silly', ...msgs])
    }

    /**
     * Wait interval ms if there is transport inside winston
     * 
     * @param {Number} wait Maximum wait time in ms
     * @param {Number} interval Check interval in ms
     * 
     * @private
     * @returns {Promise<void>}
     */
    async _waitWinston (wait, interval) {
        wait -= interval
        if (this.winston.transports.length && wait > 0) {
            await this._wait(interval)
            return this._waitWinston(wait, interval)
        }
    }

    /**
     * Wait x ms
     * 
     * @param {Number} wait wait time in ms
     * 
     * @private
     * @returns {Promise<void>}
     */
    _wait (ms) {
        return new Promise((resolve) => setTimeout(resolve, ms))
    }

    /**
     * Exit
     * 
     * @returns {Promise<void>}
     */
    async exit () {
        // wait time in mili second
        const wait = 5000
        const interval = 100
        this.winston.end()
        if (this.winston.transports.length) {
            await this._waitWinston(wait, interval)
        }
    }
}

module.exports = Logger
