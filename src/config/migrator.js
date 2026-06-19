const { Umzug, SequelizeStorage } = require('umzug');
const sequelize = require('./database');
const path = require('path');

const migrator = new Umzug({
  migrations: { glob: path.join(__dirname, '..', '..', 'migrations', '*.js') },
  context: sequelize,
  storage: new SequelizeStorage({ sequelize }),
  logger: console,
});

module.exports = migrator;
