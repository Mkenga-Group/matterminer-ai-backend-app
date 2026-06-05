const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class ChatSession extends Model { }

ChatSession.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  tenantId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  threadId: {
    // NEW: Unique identifier for the specific workflow tab/draft
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'default', // Backward compatibility for existing sessions
  },
  client_number: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  client_type: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  first_name: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  last_name: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {
      chat_history: [],
      event_draft: {},
      active_workflow: null // 'client' | 'calendar'
    },
  }
}, {
  sequelize,
  modelName: 'ChatSession',
  tableName: 'chatsessions', // As requested
  timestamps: true,
  indexes: [
    { fields: ['tenantId'] },
    { fields: ['client_number'] },
    { fields: ['email'] },
    { unique: true, fields: ['tenantId', 'threadId'] }
  ],
});

module.exports = ChatSession;