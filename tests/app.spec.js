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

    /**
     * Test start app
     */
    it('App start', async () => {
        await app.init(path.join(__dirname, './fixtures/config'))
        const initPluginsSpy = jest.spyOn(app.pm, 'initPlugins');

        const afterInitPluginFn = jest.fn();
        app.on('after-init-plugins', afterInitPluginFn)

        const startFn = jest.fn();
        app.on('start', startFn)

        await app.start()

        expect(initPluginsSpy).toHaveBeenCalled();
        expect(afterInitPluginFn).toHaveBeenCalled();
        expect(startFn).toHaveBeenCalled();
    })

    /**
     * Test add plugin
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

    /**
     * Test get plugin
     */
    it('App getPlugin', async () => {
        await app.init(path.join(__dirname, './fixtures/config'))

        jest.spyOn(app.pm, 'getPlugin').mockImplementationOnce((name) => {
            return { test: name }
        })

        const plugin = app.getPlugin('test-plugin')

        expect(plugin).toHaveProperty('test', 'test-plugin')
    })

    /**
     * Test add service
     */
    it('App addService', async () => {
        await app.init(path.join(__dirname, './fixtures/config'))

        let addedServiceDef = null
        jest.spyOn(app.container, 'addService').mockImplementationOnce((serviceDef) => {
            addedServiceDef = serviceDef
        })

        app.addService({
            test: true
        })

        expect(addedServiceDef).not.toBeNull()
        expect(addedServiceDef).toHaveProperty('test', true)
    })


    /**
     * Test get service
     */
    it('App getService', async () => {
        await app.init(path.join(__dirname, './fixtures/config'))

        jest.spyOn(app.container, 'getService').mockImplementationOnce((name) => {
            return { test: name }
        })

        const service = app.getService('test-service')

        expect(service).toHaveProperty('test', 'test-service')
    })

    /**
     * Test getNodeEnv()
     */
    it('App getNodeEnv', async () => {
        delete process.env.NODE_ENV
        expect(app.getNodeEnv()).toEqual('production')
        process.env.NODE_ENV = 'development'
        expect(app.getNodeEnv()).toEqual('development')
        process.env.NODE_ENV = 'production'
    })

    /**
     * Test exit
     */
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

    /**
     * Test exit handler
     */
    it('App exit handler', async () => {
        await app.init(path.join(__dirname, './fixtures/config'))

        jest.spyOn(app, 'exit').mockImplementationOnce(() => {
        })

        await app.exitHandler()

        expect(app.exit).toHaveBeenCalled();
    })

    /**
     * Test uncaughtException
     */
    it('App uncaughtException', async (done) => {
        await app.init(path.join(__dirname, './fixtures/config'))

        jest.spyOn(app, 'exit').mockImplementationOnce(() => { })

        await app.uncaughtExceptionHandler(new Error('Uncaught Exception'))

        expect(app.exit).toHaveBeenCalled();
        done()
    })

    /**
     * Test unhandledRejection
     */
    it('App unhandledRejection', async (done) => {
        await app.init(path.join(__dirname, './fixtures/config'))

        jest.spyOn(app, 'exit').mockImplementationOnce(() => { })

        await app.uncaughtRejectionHandler(new Error('Uncaught Rejection'))

        expect(app.exit).toHaveBeenCalled();

        done()
    })


    /**
     * Test stop
     */
    it('App stop', async (done) => {
        await app.init(path.join(__dirname, './fixtures/config'))
        await app.start()

        const stopFn = jest.fn();
        app.on('stop', stopFn)
        await app.stop()
        expect(stopFn).toHaveBeenCalled();
        done()
    })

    /**
     * Test log methods
     */
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

