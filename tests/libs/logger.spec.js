const path = require('path')
const Logger = require('../../src/libs/logger')
const config = require('../fixtures/config/config')
const { utils: { asyncReadFile, asyncFileExists } } = require('../../src')

/**
 * Test the logger
 */
describe('Lib logger', function () {

    /**
     * Test log methods
     */
    it('Logger log methods', async (done) => {
        const logger = new Logger()
        const methods = ['error', 'warn', 'info', 'verbose', 'debug', 'silly']
        for (const method of methods) {
            let log = null
            jest.spyOn(logger.winston, 'log').mockImplementationOnce(async (_log) => { log = _log })
            await logger[method]('message')
            expect(logger.winston.log).toHaveBeenCalled();
            expect(log.level).toEqual(method);
            expect(log.message).toEqual('message');
        }

        done()
    })

    /**
     * Test file transport
     */
    it('Logger file transport', async (done) => {
        const logDir = config.log.dir
        const filename = 'midgar.log'
        const logger = new Logger({
            dir: logDir,
            files: [
                {
                    filename,
                }
            ]
        })

        const level = 'info'
        const msg = 'test message'
        await logger.log(level, msg)

        // Exit to wait write and close file
        await logger.exit()

        const logFilePath = path.join(logDir, filename)
        expect(await asyncFileExists(logFilePath)).toEqual(true)
        const logContent = await asyncReadFile(logFilePath, 'utf8')
        expect(logContent).toMatch(`[${level}] ${msg}`)

        // Test no log dir with files
        expect(() => new Logger({ files: [{ filename: 'midgar.log', }] })).toThrow(Error)

        done()
    })

    /**
     * Test logger error
     */
    it('Logger error', async (done) => {
        const logger = new Logger()

        await expect(() =>
            logger.winston.emit('error', { code: 'EACCES', path: '/virtual' })
        ).toThrow(Error);

        done()
    })

    /**
     * Test exit
     */
    it('Logger exit', async (done) => {
        const logger = new Logger()

        await logger.exit()

        expect(
            logger.winston.transports.length
        ).toEqual(0)

        done()
    })
})

