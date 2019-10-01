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
const Midgar = require ('@midgar/midgar')

chai.use(chaiFs)
chai.use(chaiHttp)
chai.should()

function getTmpDir () {
  const dirname = path.join(os.tmpdir(), uid.sync(8))

  fs.mkdirSync(dirname, { mode: parseInt('0700', 8) })

  return dirname
}

const pkgPath = path.resolve(__dirname, '..', 'package.json')
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
 * @param {*} dir 
 * @param {*} args 
 * @param {*} callback 
 */
function cmd (dir, args, callback) {
  var argv = [binPath].concat(args)
  var binp = process.argv[0]
  var stderr = ''
  var stdout = ''

  var child = spawn(binp, argv, {
    cwd: dir
  })

  child.stdout.setEncoding('utf8')
  child.stdout.on('data', function ondata (str) {
    stdout += str
  })

  child.stderr.setEncoding('utf8')
  child.stderr.on('data', function ondata (str) {
    stderr += str
  })

  child.on('close', onclose)
  child.on('error', callback)

  function onclose (code) {
    callback(null, code, stdout, stderr)
  }
}

/**
 * Cli tests
 */
describe('midgar cli', function() {
  after(function (done) {
    this.timeout(30000)
    rimraf(tmpDir, done)
  })

  // Setup the env
  const ctx = setupTestEnvironment(this.fullTitle())

  // Test init command
  it ('init',  function (done) {
    cmd(ctx.dir, ['init'], function (err, code, stdout, stderr) {
      if (err) return done(err)

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

      done()
    })
  })
})

