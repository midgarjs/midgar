import path from 'path'

/**
 * @type {Midgar}
 */
import Midgar from '@midgar/midgar'

const midgar = new Midgar
midgar.start(path.join(__dirname, 'config'));
