import path from 'path'

const resolve = (p) => {
  return path.join(__dirname, p)
}

export default {
  pluginsLocalPath: resolve('../plugins'),
  log: {
    dir: resolve('../logs')
  }
}
