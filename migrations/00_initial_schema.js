const fs = require('fs');
const path = require('path');

module.exports = {
  async up({ context: sequelize }) {
    const sqlPath = path.join(__dirname, 'sql', '00_initial_schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Split SQL by statements to execute them sequentially
    const statements = sql.split(';').filter(stmt => stmt.trim() !== '');
    
    for (const statement of statements) {
      await sequelize.query(statement);
    }
  },

  async down({ context: sequelize }) {
    await sequelize.query('DROP TABLE IF EXISTS audit_logs;');
    await sequelize.query('DROP TABLE IF EXISTS chatsessions;');
    await sequelize.query('DROP TABLE IF EXISTS integrations;');
    await sequelize.query('DROP TABLE IF EXISTS events;');
    await sequelize.query('DROP TABLE IF EXISTS wallets;');
  }
};
