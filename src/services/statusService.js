const { Integration, Tenant, Event } = require('../models');
const { Op } = require('sequelize');

exports.getGlobalSyncStatus = async () => {
   return await Integration.findAll({
      where: { provider: 'google' },
      attributes: [
	 'tenantId',
	 'status',
	 'lastSyncAt',
	 'metadata',
	 'updatedAt'
      ],
      include: [{
        model: Tenant,
        attributes: ['name', 'email'] // Adjust based on your Tenant model
      }]
    });
};

exports.getTenantHealth = async (tenantId) => {
    const integration = await Integration.findOne({ 
       where: { tenantId, provider: 'google' } 
    });
 
    if (!integration) return { status: 'Not Connected' };

    const eventCount = await Event.count({ where: { tenantId } });
    const isExpired = integration.metadata.expiration < Date.now();

    return {
        provider: 'google',
	connectionStatus: integration.status, // active, revoked, etc.
        webhookHealth: isExpired ? 'Expired' : 'Healthy',
        expiresAt: new Date(Number(integration.metadata.expiration)).toLocaleString(),
        lastSuccessfulSync: integration.lastSyncAt,
	totalEventsSynced: eventCount,
        syncTokenPresent: !!integration.syncToken
    };
};
