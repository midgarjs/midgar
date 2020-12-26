const path = require('path')

const Logger = require('../src/libs/logger')
const Container = require('../src/libs/container')
const PluginManager = require('../src/libs/plugin-manager')

const { App } = require('../src')

/**
 * Test the config
 */
describe('App', function () {
    process.env.NODE_ENV = 'production'
    let app = null;
    beforeEach(() => {
        app = new App()
        console.log('NEW APP')
    });

    afterEach(() => {
        jest.clearAllMocks();
        return app.stop();
    })


    /**
     * Test init app
     */
    it('App init', async () => {
        await app.init(path.join(__dirname, './fixtures/config'))

        // Test config
        expect(app.config).not.toBeNull()
        expect(app.config).toHaveProperty('test', 'ok')
        expect(app.config).toHaveProperty('prod', true)
        expect(app.config).not.toHaveProperty('dev')

        // Test logger
        expect(app.logger).not.toBeNull()
        expect(app.logger).toBeInstanceOf(Logger)

        // Test DI container
        expect(app.container).not.toBeNull()
        expect(app.container).toBeInstanceOf(Container)

        // Test plugin manager
        expect(app.pm).not.toBeNull()
        expect(app.pm).toBeInstanceOf(PluginManager)
    })

    it('App start', async () => {
        await app.init(path.join(__dirname, './fixtures/config'))
        const initPluginsSpy = jest.spyOn(app.pm, 'initPlugins');

        const afterInitPluginFn = jest.fn();
        app.on('afterInitPlugins', afterInitPluginFn)

        const startFn = jest.fn();
        app.on('start', startFn)

        await app.start()

        expect(initPluginsSpy).toHaveBeenCalled();
        expect(afterInitPluginFn).toHaveBeenCalled();
        expect(startFn).toHaveBeenCalled();
    })

    /**
     * Test
     */
    it('App addPlugin', async () => {
        await app.init(path.join(__dirname, './fixtures/config'))

        let addedPluginDef = null
        jest.spyOn(app.pm, 'addPlugin').mockImplementationOnce((pluginDef) => {
            addedPluginDef = pluginDef
        })

        app.addPlugin({
            test: true
        })

        expect(addedPluginDef).not.toBeNull()
        expect(addedPluginDef).toHaveProperty('test', true)
    })


    it('App getPlugin', async () => {
        await app.init(path.join(__dirname, './fixtures/config'))

        jest.spyOn(app.pm, 'getPlugin').mockImplementationOnce((name) => {
            return { test: name }
        })

        const plugin = app.getPlugin('test-plugin')

        expect(plugin).toHaveProperty('test', 'test-plugin')
    })

    it('App getNodeEnv', async () => {
        delete process.env.NODE_ENV
        expect(app.getNodeEnv()).toEqual('production')
        process.env.NODE_ENV = 'development'
        expect(app.getNodeEnv()).toEqual('development')
        process.env.NODE_ENV = 'production'
    })

    it('App exit', async () => {
        await app.init(path.join(__dirname, './fixtures/config'))

        jest.spyOn(app, 'stop').mockImplementationOnce(async () => { })
        jest.spyOn(app.logger, 'exit').mockImplementationOnce(async () => { })
        jest.spyOn(process, 'exit').mockImplementationOnce(async () => { })

        await app.exit(1)

        expect(app.stop).toHaveBeenCalled();
        expect(app.logger.exit).toHaveBeenCalled();
        expect(process.exit).toHaveBeenCalled();
    })

    it('App exit handler', async () => {
        await app.init(path.join(__dirname, './fixtures/config'))

        console.log('App exit handler')
        jest.spyOn(app, 'exit').mockImplementationOnce(() => {
            console.log('Exit')
        })

        console.log('SIGUSR1 SIGUSR1 SIGUSR1 SIGUSR1')
        await app.exitHandler()

        expect(app.exit).toHaveBeenCalled();
        console.log('/App exit handler')

    })

    it('App uncaughtException', async (done) => {
        console.log('App uncaughtException')
        await app.init(path.join(__dirname, './fixtures/config'))

        jest.spyOn(app, 'exit').mockImplementationOnce(() => { })

        await app.uncaughtExceptionHandler(new Error('Uncaught Exception'))

        expect(app.exit).toHaveBeenCalled();
        console.log('/App uncaughtException')

        done()
    })

    it('App unhandledRejection', async (done) => {
        await app.init(path.join(__dirname, './fixtures/config'))

        console.log('App unhandledRejection')
        jest.spyOn(app, 'exit').mockImplementationOnce(() => { })

        await app.uncaughtRejectionHandler(new Error('Uncaught Rejection'))

        expect(app.exit).toHaveBeenCalled();
        console.log('App /unhandledRejection')

        done()
    })


    it('App stop', async (done) => {

        await app.init(path.join(__dirname, './fixtures/config'))
        await app.start()

        const stopFn = jest.fn();
        app.on('stop', stopFn)
        await app.stop()
        expect(stopFn).toHaveBeenCalled();
        done()
    })

    it('App log', async (done) => {
        await app.init(path.join(__dirname, './fixtures/config'))
        const methods = ['error', 'warn', 'info', 'verbose', 'debug', 'silly']
        for (const method of methods) {
            jest.spyOn(app.logger, method).mockImplementationOnce(async () => { })
            await app[method]('message')
            expect(app.logger[method]).toHaveBeenCalled();
        }
        done()
    })
})

