module.exports = {
    "env": {
        "es6": true,
        "node": true
    },
    "ignorePatterns": ["docs/**/*"],
    "extends": [
        "standard",
        "eslint:recommended",
    ],
    "globals": {
        "Atomics": "readonly",
        "SharedArrayBuffer": "readonly"
    },
    "parserOptions": {
        "ecmaVersion": 2018,
        "sourceType": "module"
    },
    "rules": {
    },
    "parser": "babel-eslint",
}