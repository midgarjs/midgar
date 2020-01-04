import path from 'path'

const resolve = (p) => {
  return path.join(__dirname, p)
}

export default {
  express: {
    port: 3000,
    host: 'localhost',
    ssl: false,
  },
  log: {
    stdout: true,
    level: 'error'
  }
}
