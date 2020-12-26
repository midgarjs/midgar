
const path = require('path')
const os = require('os')
const uid = require('uid-safe')
const mkdirp = require('mkdirp')

function getTmpDir (name) {
  const dirname = path.join(os.tmpdir(), uid.sync(8), name)

  mkdirp.sync(dirname, { mode: parseInt('0700', 8) })

  return dirname
}

module.exports = {
  log: {
    dir: getTmpDir('logs'),
    stdout: true,
    level: 'debug'
  },
  test: "ok"
}
