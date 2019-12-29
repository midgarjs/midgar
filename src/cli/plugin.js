export default [
  {
    command: 'add [plugin]',
    description: 'Add plugin',
    action: async ([plugin], mid) => {
      if (!mid.cli.configPath) {
        return {
          stdout: 'Cannot add ' + plugin + ' to plugins.json, Midgar config have not be resolved !'
        }
      }

      if (await mid.pm.addPlugin(plugin)) {
        return {
          stdout: plugin + ' added to plugins.js !'
        }
      }
    }
  },
  {
    command: 'rm [plugin]',
    description: 'Remove plugin',
    action: async ([plugin], mid) => {
      if (await mid.pm.removePlugin(plugin)) {
        return {
          stdout: plugin + ' removed from plugins.json !'
        }
      }
    }
  },
  {
    command: 'enable [plugin]',
    description: 'Enable plugin',
    action: async ([plugin], mid) => {
      if (await mid.pm.enablePlugin(plugin)) {
        return {
          stdout: plugin + ' enabled in plugins.json !'
        }
      }
    }
  },
  {
    command: 'disable [plugin]',
    description: 'Disable plugin',
    action: async ([plugin], mid) => {
      if (await mid.pm.disablePlugin(plugin)) {
        return {
          stdout: plugin + ' disabled in plugins.json !'
        }
      }
    }
  }
]
