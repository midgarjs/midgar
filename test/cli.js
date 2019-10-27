const { describe, it } = require('mocha')
const chai = require('chai')
const chaiHttp = require('chai-http')
const chaiFs = require('chai-fs')
const path = require('path')

const rimraf = require('rimraf')
const mkdirp = require('mkdirp')
const spawn = require('child_process').spawn
const fs = require('fs')
const os = require('os')
const uid = require('uid-safe')

/**
 * @type {Midgar}
 */
const Midgar = require ('..')

chai.use(chaiFs)
chai.use(chaiHttp)
chai.should()

function getTmpDir () {
  const dirname = path.join(os.tmpdir(), uid.sync(8))

  fs.mkdirSync(dirname, { mode: parseInt('0700', 8) })

  return dirname
}

const configPath = path.resolve(__dirname, 'fixtures/config')
const pkgPath = path.resolve(__dirname, '..', 'package.json')
// Get midgar bin js file (bin/midgar.js)
const binPath = path.resolve(path.dirname(pkgPath), require(pkgPath).bin.midgar)
const tmpDir = getTmpDir()

function setupTestEnvironment (name) {
  var ctx = {}

  before('create environment', function (done) {
    ctx.dir = path.join(tmpDir, name.replace(/[<>]/g, ''))
    mkdirp(ctx.dir, done)
  })

  after('cleanup environment', function (done) {
    this.timeout(30000)
    rimraf(ctx.dir, done)
  })

  return ctx
}


/**
 * Execute bash command
 * 
 */
function cmd (...command) {
  return new Promise((resolve, reject) => {
    const argv = [binPath].concat([...command])
    const binp = process.argv[0]
    let stderr = ''
    let stdout = ''
  
    const child = spawn (binp, argv, {
      cwd: '.'
    })
  
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', function ondata (str) {
      //console.log(str)
      stdout += str
    })
  
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', function ondata (str) {
      stderr += str
    })
  
    child.on('close', (code) => {
      resolve({code, stdout, stderr})
    })

    child.on('error', error => {
      reject(error)
    })
  })
}

/**
 * Cli tests
 */
describe('Cli init', function() {
  after(function (done) {
    this.timeout(30000)
    rimraf(tmpDir, done)
  })
  // Setup the env
  const ctx = setupTestEnvironment(this.fullTitle())

  // Test init command
  it ('init',  async function () {
    const result = await cmd('init', ctx.dir)
    if (result.stderr | result.stderr) {
      console.log('stdout')
      console.log(result.stdout)
      console.log('/stdout')
    }
    if (result.err) return done(result.err)
    if (result.stderr) return done(result.stderr)

    const files = [
      'package.json',
      '.midgarrc',
      'src/server.js',
      'src/config/config.js',
      'src/config/plugins.js',
      'src/config/config.prod.js',
      'src/config/config.dev.js'
    ]

    files.forEach(file => {
      path.join(ctx.dir, file).should.be.a.file()
    })
  })
})

/**
 * Test if the command test of the plugin test is call
 */
describe('Test plugin command', function() {
  it ('test',  async function () {
    const result = await cmd('test', '--config', configPath)
    if (result.stderr | result.stderr) {
      console.log('stdout')
      console.log(result.stdout)
      console.log('/stdout')
    }
    if (result.err) return done(result.err)
    if (result.stderr) return done(result.stderr)

    result.stdout.should.to.have.string('cli test')
  })
})

