const statusService = require('../services/statusService');

exports.getDashboardStats = async (req, res) => {
   try {
       const statuses = await statusService.getGlobalSyncStatus();
		             
       const report = statuses.map(sync => ({
	  tenant: sync.Tenant.name,
	  status: sync.status,
	  lastSync: sync.lastSyncAt,
	  // Check if the expiration timestamp is in the past
	  webhookActive: sync.metadata.expiration > Date.now(),
	  daysUntilExpiry: Math.round((sync.metadata.expiration - Date.now()) / (1000 * 60 * 60 * 24))
	}));

        res.json({ success: true, data: report, message: 'Health report' }); 
    } catch (error) {
	const errMsg = error?.message || error.response?.data?.error_description;    
	console.log('Failed getDashboardStats:', errMsg);    
	res.status(500).json({ success: false, message: 'Failed to generate health report' });
    }
};
