const fs = require("fs");
const { promisify } = require("util");
const glob = require('glob')
const merge = require('lodash.merge');

/**
 * Timer class
 */
class Timer {
    constructor () {
        this._times = {};
    }

    /**
     * Save the hrtime to start a timer
     *
     * @param {String} id Timer id
     */
    start (id) {
        this._times[id] = process.hrtime();
    }

    /**
     * Get a timer eslaped time
     *
     * @param {String}  id    Timer id
     * @param {Boolean} clean Clean time in dictionnary
     *
     * @returns {String}
     */
    getTime (id, precision = 3, clean = true) {
        if (!this._times[id]) throw new Error("invalid timer id");

        const hrtime = process.hrtime(this._times[id]);
        if (clean) delete this._times[id]

        let ms = hrtime[1] / 1000000; // divide by a million to get nano to milli

        const s = hrtime[0];
        const elapsed = s * 1000 + ms;
        return elapsed.toFixed(precision);
    }
}


/**
 * Check if it an object
 * @param {*} o
 */
function isObject (o) {
    return o instanceof Object && o.constructor === Object;
}

/**
 * Async glob
 *
 * @param {string}       dirPath Current working directory
 * @param {string}       pattern Glob pattern
 * @param {string|Array} ignore Ignore pattern or Array of ignore pattern
 *
 * @return {Array}
 */
function asyncGlob (dirPath, pattern, ignore = null) {
    return new Promise((resolve, reject) => {
        const options = { cwd: dirPath }
        if (ignore) options.ignore = ignore
        glob(pattern, options, (err, files) => {
            if (err) reject(err)
            else resolve(files)
        })
    })
}

/**
 * Async  fs.access
 *
 * @param {String} filepath File path
 * @param {Number} mode     Fs access mode
 * 
 * @private
 * @returns {Promise<boolean>}
 */
function _asyncAccess (filepath, mode) {
    return new Promise((resolve, reject) => {
        fs.access(filepath, mode, (error) => {
            resolve(!error);
        });
    });
}

/**
 * Async file exists
 *
 * @param {*} filepath
 */
const asyncFileExists = function (filepath) {
    return _asyncAccess(filepath, fs.F_OK);
};

/**
 * Async file exists
 *
 * @param {*} filepath
 */
const asyncIsWritable = function (filepath) {
    return _asyncAccess(filepath, fs.W_OK);
};


//promisify mkdirSync
//function asyncMkdir (...args) {
//    return promisify(fs.mkdirSync)(...args);
//}


module.exports = {
    merge,
    asyncGlob,
    timer: new Timer(),
    isObject,
    asyncFileExists,
    asyncIsWritable,
    asyncMkdir: promisify(fs.mkdir),
    asyncStat: promisify(fs.stat),
    asyncReaddir: promisify(fs.readdir),
    asyncWriteFile: promisify(fs.writeFile),
    asyncReadFile: promisify(fs.readFile),
};
