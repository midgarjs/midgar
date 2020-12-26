const path = require('path')

const { Plugin } = require('../../src')
const App = require('../../src/app')

const testPluginDef = require('../fixtures/plugins/test/test.plugin')
const testNpmPluginDef = require('../fixtures/plugins/test-npm/test-npm.plugin')

/**
 * Test the plugin manager
 */
describe('Lib plugin-manager', function () {
    let app = null

    beforeEach(async () => {
        app = new App()
        await app.init(path.join(__dirname, '../fixtures/config'))
        app.pm.addPlugin(testPluginDef)

    })

    afterEach(async () => {
        await app.stop()
    })

    /**
     * Test unknow npm dependency error case
     */
    it('PM unknow npm dependency', async (done) => {
        app.pm.addPlugin({
            plugin: class InvalidPlugin extends Plugin {
            },
            name: 'invalid',
            dependencies: ['xxx']
        })

        await expect(() => app.pm.initPlugins()).rejects.toThrow(Error);
        done()
    })

    /**
     * Test unknow npm dependency error case
     */
    it('PM circular dependency', async (done) => {
        app.pm.addPlugin({
            plugin: class InvalidPlugin extends Plugin {
            },
            name: 'invalid',
            dependencies: ['invalid2']
        })

        app.pm.addPlugin({
            plugin: class Invalid2Plugin extends Plugin {
            },
            name: 'invalid2',
            dependencies: ['invalid3']
        })

        app.pm.addPlugin({
            plugin: class Invalid3Plugin extends Plugin {
            },
            name: 'invalid3',
            dependencies: ['invalid']
        })


        jest.spyOn(app.pm, '_require').mockImplementationOnce((name) => {
            return testNpmPluginDef
        })

        await expect(() => app.pm.initPlugins()).rejects.toThrow(Error);
        done()
    })

    /**
     * Test getPlugin method
     */
    it('PM getPlugin', async (done) => {

        jest.spyOn(app.pm, '_require').mockImplementationOnce((name) => {
            return testNpmPluginDef
        })

        await app.pm.initPlugins()

        expect(app.pm.getPlugin('test')).toBeInstanceOf(testPluginDef.plugin)
        expect(app.pm.getPlugin('test-npm')).toBeInstanceOf(testNpmPluginDef.plugin)
        expect(() => app.pm.getPlugin('xxx')).toThrow(Error);
        done()
    })
})

