const path = require('path')

const resolve = (p) => {
  return path.join(__dirname, p)
}

module.exports = {
  'configPath': resolve('../config'),
}