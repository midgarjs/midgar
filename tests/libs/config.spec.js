const path = require('path')

const { loadConfig } = require('../../src/libs/config')

/**
 * Test the config
 */
describe('Lib config', function () {

    /**
     * Test
     */
    it('loadConfig', async (done) => {
        const configPath = path.join(__dirname, '../fixtures/config')

        let config = await loadConfig(configPath, 'production')
        expect(config).toHaveProperty('test', 'ok')
        expect(config).toHaveProperty('prod', true)
        expect(config).not.toHaveProperty('dev')
        expect(config).not.toHaveProperty('staging')

        config = await loadConfig(configPath, 'development')
        expect(config).toHaveProperty('test', 'ok')
        expect(config).toHaveProperty('dev', true)
        expect(config).not.toHaveProperty('prod')
        expect(config).not.toHaveProperty('staging')

        config = await loadConfig(configPath, 'staging')
        expect(config).toHaveProperty('test', 'ok')
        expect(config).toHaveProperty('staging', true)
        expect(config).not.toHaveProperty('prod')
        expect(config).not.toHaveProperty('dev')


        await expect(loadConfig(configPath + 'xxx', 'production')).rejects.toThrowError(Error);

        done()
    })
})

