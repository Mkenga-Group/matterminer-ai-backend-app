const sequelize = require('../config/database');

const Event = require('./Event');
const AuditLog = require('./AuditLog');
const Integration = require('./Integration');
const Wallet = require('./Wallet');
const ChatSession = require('./ChatSession');

Event.hasMany(AuditLog, { foreignKey: 'eventId', as: 'auditLogs' });
AuditLog.belongsTo(Event, { foreignKey: 'eventId', as: 'event' });

Wallet.hasMany(AuditLog, { foreignKey: 'tenantId', sourceKey: 'tenantId', as: 'auditLogs' });
AuditLog.belongsTo(Wallet, { foreignKey: 'tenantId', targetKey: 'tenantId', as: 'wallet' });

ChatSession.hasMany(AuditLog, { foreignKey: 'sessionId', as: 'auditLogs' });
AuditLog.belongsTo(ChatSession, { foreignKey: 'sessionId', as: 'chatSession' });

module.exports = { sequelize, Event, AuditLog, Integration, Wallet, ChatSession };
