module.exports = [
  {
    command: 'test',
    description: 'Cli test commad',
    action: async (args, midgar) => {
      console.log('cli test')
      process.exit(0)
    }
  }
]