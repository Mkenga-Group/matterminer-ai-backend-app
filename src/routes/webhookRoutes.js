express = require('express');
const router = express.Router();
const { Integration } = require('../models');
const { connectRabbitMQ } = require('../utils/rabbitMQ');

router.post('/google-callback', async (req, res) => {
   const channelId = req.headers['x-goog-channel-id'];
   const resourceId = req.headers['x-goog-resource-id'];
   const state = req.headers['x-goog-resource-state'];

   // 1. Immediate acknowledgement
   res.status(200).send('OK');

   if (state === 'exists') { 
      try {
          // 2. Find the integration by resourceId stored inside the metadata JSON */
	  const integration = await Integration.findOne({
	     where: {
		provider: 'google',
		metadata: {
                   resourceId: resourceId
		}
	      }
	  });

	  if (integration) {
	     const channel = await connectRabbitMQ();
	     const payload = { 
		action: 'FULL_SYNC', 
		tenantId: integration.tenantId 
	     };


	     channel.sendToQueue('calendar_sync', Buffer.from(JSON.stringify(payload)), {
	       persistent: true
	     });
	     console.log(`[Webhook] Sync queued for Tenant: ${integration.tenantId}`);
	   }
        } catch (error) {
	   console.error('[Webhook Error]:', error.message);
	}
    }
});

module.exports = router;
