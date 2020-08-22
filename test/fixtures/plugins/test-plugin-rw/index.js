import Test2Plugin from '../test-plugin-2'

/**
 * Test plugin
 */
class TestRwPlugin extends Test2Plugin {}

export default TestRwPlugin

export const config = {
  rewrite: {
    plugins: {
      'test-plugin-2': './rewrite/test-plugin-2.js'
    },
    modules: {
      fooxxx: {
        'test-plugin-2': {
          'file-1.js': './rewrite/fooxxx/file-rw.js'
        }
      }
    },
    files: {
      '@test/test-plugin-3': {
        'files/test-rw.txt': './rewrite/files/test.txt'
      }
    }
  }
}

export const dependencies = ['test-plugin']
