export default [
  {
    command: 'test',
    description: 'Cli test commad',
    options: [
      {
        flags: '--topt [value]',
        description: 'test option'
      }
    ],
    action: async (mid, cmd) => {
      return { stdout: cmd.topt }
    }
  }
]
