export default [
  {
    command: 'test2',
    description: 'Cli test commad',
    action: async (args, midgar) => {
      return { stdout: 'cli test 2' }
    }
  }
]
