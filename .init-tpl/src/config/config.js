
const path = require('path')

const resolve = (p) => {
  return path.join(__dirname, p)
}

module.exports = {
  plugin: {
    dir: resolve('../plugins')
  },
  log: {
    dir: resolve('../logs')
  }
}
