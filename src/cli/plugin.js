export default [
  // add command
  {
    command: 'add [plugin]',
    description: 'Add plugin',
    action: async (mid, plugin) => {
      if (!mid.cli.configPath) {
        return {
          stdout: 'Cannot add ' + plugin + ' to plugins.json, Midgar config have not be resolved !'
        }
      }

      if (await mid.addPlugin(plugin)) {
        return {
          stdout: plugin + ' added to plugins.js !'
        }
      }
    }
  },
  // rm command
  {
    command: 'rm [plugin]',
    description: 'Remove plugin',
    action: async (mid, plugin) => {
      if (await mid.removePlugin(plugin)) {
        return {
          stdout: plugin + ' removed from plugins.json !'
        }
      }
    }
  },
  // enable command
  {
    command: 'enable [plugin]',
    description: 'Enable plugin',
    action: async (mid, plugin) => {
      if (await mid.enablePlugin(plugin)) {
        return {
          stdout: plugin + ' enabled in plugins.json !'
        }
      }
    }
  },
  // disable command
  {
    command: 'disable [plugin]',
    description: 'Disable plugin',
    action: async (mid, plugin) => {
      if (await mid.disablePlugin(plugin)) {
        return {
          stdout: plugin + ' disabled in plugins.json !'
        }
      }
    }
  }
]
