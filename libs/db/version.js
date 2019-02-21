const path = require('path')

const utils = require('@midgar/utils')
const DbVersion = require('@midgar/db-version')
const pm = require('@midgar/plugin-manager')

module.exports = class Version {
  constructor (db, sequelize) {
    this.db = db
    this.sequelize = sequelize

    const schemaDirs = pm.getDirs('dbSchemas').then((schemaDirs) => {
      return schemaDirs.map((migration) => {
        return {tag: migration.plugin, path: migration.path}
      })
    })

    const dataDirs = pm.getDirs('dbData').then((dataDirs) => {
      return dataDirs.map((migration) => {
        return {tag: migration.plugin, path: migration.path}
      })
    })

    const dirs = Promise.all([schemaDirs, dataDirs])

    this.migrator = new DbVersion({
      schemaDirs: dirs[0],
      dataDirs: dirs[1],
      storageOptions: {
        sequelize: this.sequelize
      },
      execParams: [
        this.sequelize.queryInterface, this.sequelize.constructor, this.db
      ]
    })
  }

  upAll () {
    return this.migrator.upAll()
  }

  reset () {
    return this.migrator.down({to: 0});
  }

  rollback(nbVerion = 1) {
    return this.status().then(({ executed, pending }) => {
      if (executed.length === 0) {
        return Promise.reject(new Error('Already at initial state'));
      }
      const prev = executed[executed.length - nbVerion].name;
      return this.migrator.down({ to: prev });
    })
  }

  next() {
    return this.status().then(({ executed, pending }) => {
      if (pending.length === 0) {
        return Promise.reject(new Error('No pending migrations'));
      }
      const next = pending[0].name;
      return this.migrator.up({ to: next });
    })
  }


  async status() {
      return this.migrator.status()
  }
}


