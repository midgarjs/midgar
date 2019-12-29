
import path from 'path'
import os from 'os'
import uid from 'uid-safe'
import mkdirp from 'mkdirp'

import CustomLogger from './custom-logger'

const resolve = (p) => {
  return path.join(__dirname, p)
}

function getTmpDir (name) {
  const dirname = path.join(os.tmpdir(), uid.sync(8), name)

  mkdirp.sync(dirname, { mode: parseInt('0700', 8) })

  return dirname
}

export default {
  web: {
    port: 4000,
    host: 'localhost',
    ssl: false,
    sslCert: '',
    sslKey: ''
  },
  logger: (config) => {
    return new CustomLogger(config)
  },
  log: {
    dir: getTmpDir('logs'),
    stdout: false,
    level: 'error'
  },
  plugin: {
    dir: resolve('../plugins')
  }
}