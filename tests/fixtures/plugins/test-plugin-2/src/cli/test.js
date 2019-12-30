export default [
  {
    command: 'test',
    description: 'Cli test commad',
    action: async (args, midgar) => {
      return { stdout: 'cli test 2' }
    }
  }
]
