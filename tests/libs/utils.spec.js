const fs = require('fs')
jest.mock('glob')
const glob = require('glob')
const utils = require('../../src/libs/utils')

/**
 * Test the utils lib
 */
describe('Lib utils', function () {

    /**
     * Test timer
     */
    it('Utils timer', () => {
        const timerId = 'test'
        utils.timer.start(timerId)

        // Moke hrtime to add 1 second
        jest.spyOn(process, 'hrtime').mockImplementationOnce(() => {
            return [1, 0]
        })

        expect(utils.timer.getTime(timerId, 3, false)).toEqual('1000.000')


        // Moke hrtime to add 1 second
        jest.spyOn(process, 'hrtime').mockImplementationOnce(() => {
            return [0, 500000000]
        })
        // Test precison 2 and clean timer
        expect(utils.timer.getTime(timerId, 2)).toEqual('500.00')

        // Test get time error
        expect(() => utils.timer.getTime(timerId)).toThrow(Error);
    })

    /**
     * Test isObject
     */
    it('Utils isObject', () => {
        expect(utils.isObject({})).toEqual(true)
        expect(utils.isObject({ test: true })).toEqual(true)
        expect(utils.isObject(class Test { })).toEqual(false)
        expect(utils.isObject('test')).toEqual(false)
    })

    /**
     * Test asyncGlob
     */
    it('Utils asyncGlob', async (done) => {
        const testDirPath = '/test/path'
        const testPattern = '**/*.js'
        const ignorePattern = '**/*.test.js'

        const expectResult = [
            'file-1.js',
            'file-2.js',
            'file-3.js',
        ]

        // Default test
        glob.mockImplementationOnce((pattern, options, callback) => {
            expect(pattern).toEqual(testPattern)
            expect(options).toHaveProperty('cwd', testDirPath)
            callback(null, expectResult)
        })

        let result = await utils.asyncGlob(testDirPath, testPattern)
        expect(glob).toHaveBeenCalled();
        expect(result).toEqual(expectResult)


        // With ignore pattern
        glob.mockImplementationOnce((pattern, options, callback) => {
            expect(pattern).toEqual(testPattern)
            expect(options).toHaveProperty('cwd', testDirPath)
            expect(options).toHaveProperty('ignore', ignorePattern)
            callback(null, expectResult)
        })

        result = await utils.asyncGlob(testDirPath, testPattern, ignorePattern)
        expect(glob).toHaveBeenCalled();
        expect(result).toEqual(expectResult)

        // With error
        glob.mockImplementationOnce((pattern, options, callback) => {
            expect(pattern).toEqual(testPattern)
            expect(options).toHaveProperty('cwd', testDirPath)
            callback(new Error('Some error'), null)
        })

        await expect(utils.asyncGlob(testDirPath, testPattern)).rejects.toThrow(Error)

        expect(glob).toHaveBeenCalled();

        done()
    })

    /**
     * Test asyncFileExists
     */
    it('Utils asyncFileExists', async (done) => {
        const testFilepath = '/test/path'
        jest.spyOn(fs, 'access').mockImplementationOnce((filepath, mode, callback) => {
            expect(filepath).toEqual(testFilepath)
            expect(mode).toEqual(fs.F_OK)
            callback()
        })

        let result = await utils.asyncFileExists(testFilepath)

        expect(fs.access).toHaveBeenCalled();
        expect(result).toEqual(true)


        jest.spyOn(fs, 'access').mockImplementationOnce((filepath, mode, callback) => {
            expect(filepath).toEqual(testFilepath)
            expect(mode).toEqual(fs.F_OK)
            callback(new Error('ENOENT: no such file or directory, access'))
        })

        result = await utils.asyncFileExists(testFilepath)

        expect(fs.access).toHaveBeenCalled();
        expect(result).toEqual(false)
        done()
    })

    /**
     * Test asyncIsWritable
     */
    it('Utils asyncIsWritable', async (done) => {
        const testFilepath = '/test/path'
        jest.spyOn(fs, 'access').mockImplementationOnce((filepath, mode, callback) => {
            expect(filepath).toEqual(testFilepath)
            expect(mode).toEqual(fs.W_OK)
            callback()
        })

        let result = await utils.asyncIsWritable(testFilepath)

        expect(fs.access).toHaveBeenCalled();
        expect(result).toEqual(true)


        jest.spyOn(fs, 'access').mockImplementationOnce((filepath, mode, callback) => {
            expect(filepath).toEqual(testFilepath)
            expect(mode).toEqual(fs.W_OK)
            callback(new Error('ENOENT: no such file or directory, access'))
        })

        result = await utils.asyncIsWritable(testFilepath)

        expect(fs.access).toHaveBeenCalled();
        expect(result).toEqual(false)
        done()
    })
})

