module.exports = {
  port: 3000,
  baseUrl: 'http://localhost:{port}',
  public: {
    enable: true,
    baseUrl: 'http://localhost:{port}',
    port: 3100
  },
  log: {
    stdout: true,
    level: 'debug'
  }
}