const walletService = require('../services/walletService');

exports.trackUsage = async (req, res) => {
  try {
    const { total_tokens } = req.body;

    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'];

    if (!tenantId) {
       console.error("Missing Tenant ID in request");
       return res.status(401).json({ success: false, message: 'Unauthorized: No Tenant ID' });
    }

    if (!tenantId || !total_tokens) {
      return res.status(400).json({ success: false, message: 'Missing tenantId or usage data' });
    }

    const result = await walletService.depleteTokens(tenantId, total_tokens);
    //-console.log('CCCCCCCCCCCCCCCCCCCCCCCCCCC ',result);
    if(!result.status){
      res.status(404).json({
          success: true,
          message: result.message
      });
      return;	    
    }
    res.json({
	success: true,    
	balance: result.balance,
	message: result.message    
    });
  } catch (err) {
    const errMsg = err?.message || err.response?.data?.error_description;	  
    console.error('track usage ', errMsg);	  
    res.status(500).json({ success: false, message: 'Failed trackUsage' });
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
    const errMsg = err?.message || err.response?.data?.error_description;	  
    console.error('check sufficient bal ',errMsg);	  
    res.status(500).json({ success: false, message: 'Failed to process token usage: checkSufficientBalance' });
  }
};
