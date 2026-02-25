const walletService = require('../services/walletService');

exports.trackUsage = async (req, res) => {
  try {
    const { total_tokens } = req.body;

    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'];

    if (!tenantId) {
       console.error("Missing Tenant ID in request");
       return res.status(401).json({ success: false, error: 'Unauthorized: No Tenant ID' });
    }

    if (!tenantId || !total_tokens) {
      return res.status(400).json({ success: false, error: 'Missing tenantId or usage data' });
    }

    const result = await walletService.depleteTokens(tenantId, total_tokens);
    
    res.json({
	success: true,    
	newBalance: result.newBalance
    });
  } catch (err) {
    console.error('track usage ', err);	  
    res.status(500).json({ success: false, error: 'internal error' });
  }
};

exports.checkSufficientBalance = async (req, res) => {
  try {
   
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'];

    if (!tenantId) {
       console.error("Missing Tenant ID in request");
       return res.status(401).json({ success: false, error: 'Unauthorized: No Tenant ID' });
   }

   const result = await walletService.hasSufficientBalance(tenantId);

   res.json(result);
  } catch (err) {
    console.error('check sufficient bal ',err);	  
    res.status(500).json({ success: false, error: 'Failed to process token usage' });
  }
};
