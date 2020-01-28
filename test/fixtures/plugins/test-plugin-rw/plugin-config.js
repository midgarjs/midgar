export default {
  rewrite: {
    plugin: 'test-plugin-2',
    modules: {
      fooxxx: {
        'test-plugin-2': {
          'file-1.js': './rewrite/fooxxx/file-rw.js'
        }
      }
    },
    files: {
      '@test/test-plugin-3': {
        'files/test-rw.txt': './files/test.txt'
      }
    }
  }
}
