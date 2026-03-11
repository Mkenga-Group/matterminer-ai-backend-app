const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class ChatSession extends Model {}

ChatSession.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false
  },
  tenantId: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  client_number: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  client_type: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  first_name: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  last_name: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true
  }
}, {
  sequelize,
  modelName: 'ChatSession',
  tableName: 'chatsessions',
  timestamps: true,
  indexes: [
    { fields: ['tenantId'] },
    { fields: ['client_number'] },
    { fields: ['email'] }
  ]
});

module.exports = ChatSession;
