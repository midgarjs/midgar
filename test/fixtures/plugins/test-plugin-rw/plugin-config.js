export default {
  rewritePlugin: 'test-plugin-2',
  rewriteFile: {
    fooxxx: {
      'test-plugin-2': {
        'file-1.js': './rewrite/fooxxx/file-rw.js'
      }
    }
  }
}
