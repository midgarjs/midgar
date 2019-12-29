
import path from 'path'
import fs from 'fs'
import os from 'os'
import uid from 'uid-safe'
import mkdirp from 'mkdirp'

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
    ssl: true,
    sslCert: fs.readFileSync(resolve('../ssl/server.crt'), 'utf8'),
    sslKey: fs.readFileSync(resolve('../ssl/key.pem'), 'utf8')
  },
  log: {
    dir: getTmpDir('logs'),
    stdout: true,
    level: 'error'
  },
  plugin: {
    dir: resolve('../plugins')
  }
}
