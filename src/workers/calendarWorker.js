const { connectRabbitMQ } = require('../utils/rabbitMQ');
const googleService = require('../services/googleCalendarService');
const { Event } = require('../models');

async function startWorker() {
   const channel = await connectRabbitMQ();
   if (!channel) {
      console.error('[Worker] Could not connect to RabbitMQ. Exiting...');
      process.exit(1);
   };

   const queue = 'calendar_sync';
   await channel.assertQueue(queue, { durable: true });
   channel.prefetch(1); // Process one tenant at a time to prevent rate limiting

   console.log(`[*] Worker active and listening for messages in ${queue}`);

   channel.consume(queue, async (msg) => {
     if (!msg) return;	          

     const { action, tenantId } = JSON.parse(msg.content.toString());
     console.log(`[Worker] Processing ${action} for Tenant: ${tenantId}`);
	   
     try {
         if (action === 'FULL_SYNC' || action === 'INCREMENTAL_SYNC') {
	     console.log(`[Worker] Starting Full Sync for Tenant: ${tenantId}`);
							                
	     const changedEvents = await googleService.fetchChangedEvent(tenantId);

	     // Use a loop to Upsert (Update or Insert)
             for (const gEvent of changedEvents) {
		 if(gEvent.status === 'cancelled') {
		     // Event was deleted on Google     
                     await Event.destroy({
		        where: { google_event_id: gEvent.id, tenantId }
	             });
		  }else{  
	             await Event.upsert({
                         google_event_id: gEvent.id,
			 tenantId: tenantId,
			 title: gEvent.summary || '(No Title)',
			 description: gEvent.description || '',
			 startTime: gEvent.start.dateTime || gEvent.start.date,
		         endTime: gEvent.end.dateTime || gEvent.end.date,
			 status: 'synced'
		      });
		   }
	      }

	      // 3. Update the last sync timestamp	 
              await Integration.update(
	         { lastSyncAt: new Date(), status: 'active' },
	         { where: { tenantId, provider: 'google' } }
	      );

	      console.log(`[Worker] Sync successfu; for Tenant: ${tenantId}`);
         }
         
	 if(action === 'REVOKE') {
              console.log(`[Worker] Revoking Google Integration for Tenant: ${tenantId}`);
	      // 1. Find the integration metadata
              const integration = await Integration.findOne({ 
		  where: { tenantId, provider: 'google' } 
	      });

	      if (integration && integration.metadata.channelId) {
                  try{
                      const tokens = await getTokens(tenantId);
	              const oauth2Client = new google.auth.OAuth2(
		          process.env.GOOGLE_CLIENT_ID,
			  process.env.GOOGLE_CLIENT_SECRET
		      );

		      oauth2Client.setCredentials(tokens);

		      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
		      // 2. Tell Google to stop sending webhooks for this channel    
		      await calendar.channels.stop({
			  requestBody: {
			     id: integration.metadata.channelId,
			     resourceId: integration.metadata.resourceId
			  }
		      });
		   }catch(stopErr){
                      console.error('[Worker] Google Channel.stop failed (it might have already expired):', stopErr.message);
		   } 

		   // 3. Clean up Database	 
		   await Integration.destroy({ where: { tenantId, provider: 'google' } });	    

		   // 4. Clean up Redis tokens	  
		   const { deleteTokens } = require('../services/redisService');
		   await deleteTokens(tenantId);
		   console.log(`[Worker] Revocation complete for Tenant: ${tenantId}`);			    
	      }
           }  
           channel.ack(msg);
       } catch (error) {
	   if (error.message.includes('invalid_grant') || error.code === 401) {
	       console.error(`[Alert] Tenant ${tenantId} has revoked access.`);		 
	       await Integration.update(
		  { status: 'revoked' }, 
	          { where: { tenantId, provider: 'google' } }
	       );
	       return channel.ack(msg); 	   
            }
            console.error(`[Worker] Error processing ${action}:`, error.message);
	    // Re-queue if it's a network/timeout error, otherwise discard (false)
	    const isTransient = error.code >= 500 || error.message.includes('timeout');   
	    channel.nack(msg, false, isTransient);
	 }
    });
}

// Global error handlers for the worker process
process.on('unhandledRejection', (err) => console.error('Unhandled Worker Rejection:', err));
process.on('uncaughtException', (err) => console.error('Uncaught Worker Exception:', err));

startWorker();
