export default {
  rewrite: {
    plugin: 'test-plugin-2',
    modules: {
      fooxxx: {
        'test-plugin-2': {
          'file-1.js': './rewrite/fooxxx/file-rw.js'
        }
      }
    }
  }
}
