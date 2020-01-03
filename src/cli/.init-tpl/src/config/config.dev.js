import path from 'path'

const resolve = (p) => {
  return path.join(__dirname, p)
}

export default {
  web: {
    port: 3000,
    host: 'localhost',
    ssl: false,
    sslCert: '',
    sslKey: ''
  },
  public: {
    enable: true,
    path: resolve('../public'),
    port: 3100,
    host: 'localhost',
    ssl: false,
    sslCert: '',
    sslKey: ''
  },
  log: {
    stdout: true,
    level: 'debug'
  },
  logger: () => {
    return {}
  }
}
