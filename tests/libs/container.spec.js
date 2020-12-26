const path = require('path')

const { Plugin } = require('../../src')
const App = require('../../src/app')

const testModulenDef = require('../fixtures/modules/test.module')
const test2ModulenDef = require('../fixtures/modules/test2.module')

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
     * Test unknow npm dependency error case
     */
    it('Container addModule', async (done) => {
        const type = 'test-type'
        const name = 'test'
        class TestModule {
        }

        expect(() => app.container.addModule(type, { name, module: TestModule, dependencies: [{ name: 'test2', type }, 'test3'] })).not.toThrow(Error)
        expect(() => app.container.addModule(type, { name, module: () => { } })).not.toThrow(Error)

        // Invalid module definition
        expect(() => app.container.addModule(type, '{}')).toThrow(Error)
        expect(() => app.container.addModule(type, {})).toThrow(Error)
        expect(() => app.container.addModule(type, { name })).toThrow(Error)
        expect(() => app.container.addModule(type, { module: TestModule })).toThrow(Error)
        expect(() => app.container.addModule(type, { name: () => { }, module: TestModule })).toThrow(Error)
        expect(() => app.container.addModule(type, { name, module: 'x' })).toThrow(Error)
        expect(() => app.container.addModule(type, { name, module: TestModule, dependenciesType: 1 })).toThrow(Error)
        expect(() => app.container.addModule(type, { name, module: TestModule, dependencies: 1 })).toThrow(Error)
        expect(() => app.container.addModule(type, { name, module: TestModule, dependencies: [1] })).toThrow(Error)
        expect(() => app.container.addModule(type, { name, module: TestModule, dependencies: [{}] })).toThrow(Error)
        expect(() => app.container.addModule(type, { name, module: TestModule, dependencies: [{ name: 1, type: 'test' }] })).toThrow(Error)
        expect(() => app.container.addModule(type, { name, module: TestModule, dependencies: [{ name: 'test' }] })).toThrow(Error)
        expect(() => app.container.addModule(type, { name, module: TestModule, dependencies: [{ name: 'test', type: 1 }] })).toThrow(Error)

        done()
    })

    /**
     * Test getModule method
     */
    it('Container getModule', async (done) => {
        const type = 'test-type'
        class TestModule {
            constructor (app) {
                this.app = app
            }
        }

        app.container.addModule(type, {
            module: TestModule,
            name: 'test'
        })

        class Test2Module {
            constructor (app, testModule, testFnModule) {
                this.app = app
                this.testModule = testModule
                this.testFnModule = testFnModule
            }
        }
        app.container.addModule(type, {
            module: () => 'test-function-value',
            name: 'test-function',
        })

        app.container.addModule(type, {
            module: Test2Module,
            name: 'test2',
            dependencies: ['test', { type, name: 'test-function' }]
        })

        const testModule = app.container.getModule(type, 'test')

        expect(testModule).toBeInstanceOf(TestModule)
        expect(testModule.app).toBeInstanceOf(App)

        const test2Module = app.container.getModule(type, 'test2')
        expect(test2Module).toBeInstanceOf(Test2Module)
        expect(test2Module.app).toBeInstanceOf(App)
        expect(test2Module.testModule).toBeInstanceOf(TestModule)
        expect(test2Module.testFnModule).toEqual('test-function-value')

        expect(() => app.container.getModule(type, 'testx')).toThrow(Error)
        expect(() => app.container.getModule('xxx', 'test')).toThrow(Error)

        done()
    })


    /**
     * Test circular dependency
     */
    it('Container circular dependency', async (done) => {
        const type = 'test-type'

        app.container.addModule(type, {
            module: () => { },
            name: 'test',
            dependencies: ['test2'],
        })

        app.container.addModule(type, {
            module: () => { },
            name: 'test2',
            dependencies: ['test3'],
        })

        app.container.addModule(type, {
            module: () => { },
            name: 'test3',
            dependencies: ['test'],
        })
        expect(() => app.container.getModule(type, 'test')).toThrow(Error)
        done()
    })

    /**
     * Test addModuleDir method
     */
    it('Container addModuleDir', async (done) => {
        const type = 'test-type'

        await app.container.addModuleDir(type, path.resolve(__dirname, '../fixtures/modules'), '*.module.js')

        expect(app.container.getModule(type, 'test')).toBeInstanceOf(testModulenDef.module)
        expect(app.container.getModule(type, 'test2')).toBeInstanceOf(test2ModulenDef.module)
        done()
    })


    /**
     * Test intanciateModules method
     */
    it('Container intanciateModules', async (done) => {
        const type = 'test-type'
        class TestModule {
        }

        app.container.addModule(type, {
            module: TestModule,
            name: 'test'
        })

        class Test2Module {
        }

        app.container.addModule(type, {
            module: Test2Module,
            name: 'test2'
        })
        app.container.intanciateModules(type)
        const instances = app.container.getInstances(type)
        expect(Object.keys(instances).length).toEqual(2)

        expect(instances['test']).toBeInstanceOf(TestModule)
        expect(instances['test2']).toBeInstanceOf(Test2Module)

        done()
    })
})

