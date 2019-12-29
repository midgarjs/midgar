import path from 'path'

const resolve = (p) => {
  return path.join(__dirname, p)
}

export default {
  plugin: {
    dir: resolve('../plugins')
  },
  log: {
    dir: resolve('../logs')
  }
}
