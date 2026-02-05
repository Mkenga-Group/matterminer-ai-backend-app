const { google } = require('googleapis');
const { v4: uuidv4 } = require('uuid');
const { Integration } = require('../models');
const { getTokens } = require('./redisService');

exports.registerCalendarWatch = async (tenantId) => {
  const tokens = await getTokens(tenantId);
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
   );
   oauth2Client.setCredentials(tokens);
   const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

   const channelId = uuidv4();
	    
   const response = await calendar.events.watch({
      calendarId: 'primary',
      requestBody: {
	id: channelId,
	type: 'web_hook',
	address: `https://dev.matterminer.com/calendar/webhooks/google-callback`
      },
    });

    // Update or Create the Integration record
    await Integration.upsert({  
       tenantId: tenantId,
       provider: 'google',
       status: 'active',
       metadata: {
         channelId: channelId,
         resourceId: response.data.resourceId,
	 expiration: response.data.expiration
       } 
     });

     return response.data;
};
