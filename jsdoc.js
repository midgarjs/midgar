'use strict';
const path = require('path')

const resolve = (p) => {
  return path.join(__dirname, p)
}

module.exports = {
  "opts": {
    "destination": resolve("./docs/"), // same as -d ./out/
    "template": "./node_modules/ink-docstrap/template"
  },
  "plugins": [],
  "recurseDepth": 10,
  "source": {
    "exclude": [resolve("./node_modules/")],
    "includePattern": ".+\\.js(doc|x)?$",
    "excludePattern": "(^|\\/|\\\\)_"
  },
  "tags": {
    "allowUnknownTags": true,
    "dictionaries": [
      "jsdoc",
      "closure"
    ]
  },
  "templates": {
    "cleverLinks": false,
    "monospaceLinks": false,
    "theme" : "lumen",
    "linenums" : true
  }
}