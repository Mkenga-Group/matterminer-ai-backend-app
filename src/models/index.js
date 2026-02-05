const Event = require('./Event');
const AuditLog = require('./AuditLog');
const Integration = require('./Integration');

Event.hasMany(AuditLog, { foreignKey: 'eventId', as: 'auditLogs' });
AuditLog.belongsTo(Event, { foreignKey: 'eventId', as: 'event' });

module.exports = { Event, AuditLog, Integration };
