const path = require('path')

/**
 * @type {Midgar}
 */
const Midgar = require ('@midgar/midgar')

const midgar = new Midgar
midgar.start(path.join(__dirname, 'config'));
