const path = require('path')

const App = require('../../src/app')

const testServiceDef = require('../fixtures/services/test.service')
const test2ServiceDef = require('../fixtures/services/test2.service')

/**
 * Test the config
 */
describe('Lib container', function () {
    let app = null

    beforeEach(async () => {
        app = new App()
        await app.init(path.join(__dirname, '../fixtures/config'))

    })

    afterEach(async () => {
        await app.stop()
    })

    /**
     * Test addService
     */
    it('Container addService', async (done) => {
        const name = 'test'
        class TestService {
        }

        expect(() => app.container.addService({ name, service: () => { } })).not.toThrow(Error)

        // Invalid module definition
        expect(() => app.container.addService('{}')).toThrow(Error)
        expect(() => app.container.addService({})).toThrow(Error)
        expect(() => app.container.addService({ name })).toThrow(Error)
        expect(() => app.container.addService({ service: TestService })).toThrow(Error)
        expect(() => app.container.addService({ name: () => { }, service: TestService })).toThrow(Error)
        expect(() => app.container.addService({ name, service: 'x' })).toThrow(Error)
        expect(() => app.container.addService({ name, service: TestService, dependencies: 1 })).toThrow(Error)
        expect(() => app.container.addService({ name, service: TestService, dependencies: [1] })).toThrow(Error)
        expect(() => app.container.addService({ name, service: TestService, dependencies: [{}] })).toThrow(Error)

        done()
    })

    /**
     * Test getService method
     */
    it('Container getService', async (done) => {
        class TestService {
            constructor (app) {
                this.app = app
            }
        }

        app.container.addService({
            service: TestService,
            name: 'test'
        })

        class Test2Service {
            constructor (app, testService, testFnService) {
                this.app = app
                this.testService = testService
                this.testFnService = testFnService
            }
        }
        app.container.addService({
            service: () => 'test-function-value',
            name: 'test-function',
        })

        app.container.addService({
            service: Test2Service,
            name: 'test2',
            dependencies: ['test', 'test-function']
        })

        const testService = app.container.getService('test')

        expect(testService).toBeInstanceOf(TestService)
        expect(testService.app).toBeInstanceOf(App)

        const test2Service = app.container.getService('test2')
        expect(test2Service).toBeInstanceOf(Test2Service)
        expect(test2Service.app).toBeInstanceOf(App)
        expect(test2Service.testService).toBeInstanceOf(TestService)
        expect(test2Service.testFnService).toEqual('test-function-value')

        expect(() => app.container.getService('testx')).toThrow(Error)

        done()
    })

    /**
     * Test circular dependency
     */
    it('Container circular dependency', async (done) => {
        const type = 'test-type'

        app.container.addService({
            service: () => { },
            name: 'test',
            dependencies: ['test2'],
        })

        app.container.addService({
            service: () => { },
            name: 'test2',
            dependencies: ['test3'],
        })

        app.container.addService({
            service: () => { },
            name: 'test3',
            dependencies: ['test'],
        })
        expect(() => app.container.getService('test')).toThrow(Error)
        done()
    })

    /**
     * Test addServiceDir method
     */
    it('Container addServiceDir', async (done) => {
        await app.container.addServiceDir(path.resolve(__dirname, '../fixtures/services'), '*.service.js')

        expect(app.container.getService('test')).toBeInstanceOf(testServiceDef.service)
        expect(app.container.getService('test2')).toBeInstanceOf(test2ServiceDef.service)
        done()
    })
})

