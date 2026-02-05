const { google } = require('googleapis');
const { getTokens } = require('./redisService'); // Our Redis helper

const { Integration } = require('../models');

const createGoogleClient = (tokens) => {
   const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
   );
   oauth2Client.setCredentials(tokens);
   return google.calendar({ version: 'v3', auth: oauth2Client });
};

exports.syncLocalToGoogle = async (tenantId, eventData, googleEventId = null) => {
   const tokens = await getTokens(tenantId);
   if (!tokens) return null; // Or handle re-auth logic

      const calendar = createGoogleClient(tokens);
           	  
      const gEvent = {
         summary: eventData.title,
	 description: eventData.description,
         start: { dateTime: new Date(eventData.startTime).toISOString() },
         end: { dateTime: new Date(eventData.endTime).toISOString() },
      };

      if (googleEventId) {
	 // Update existing	      
	 const response = await calendar.events.update({
	    calendarId: 'primary',
	    eventId: googleEventId,
            resource: gEvent,
	 });
         return response.data.id;
       } else {
	 // Create new		        
	 const response = await calendar.events.insert({
	     calendarId: 'primary',
	     resource: gEvent,
	 });
	 return response.data.id;
       }
};

exports.deleteGoogleEvent = async (tenantId, googleEventId) => {
   const tokens = await getTokens(tenantId);
   if (!tokens || !googleEventId) return;

   const calendar = createGoogleClient(tokens);
   await calendar.events.delete({ calendarId: 'primary', eventId: googleEventId });
};

exports.fetchAllGoogleEvents = async (tenantId) => {
   const tokens = await getTokens(tenantId);
   const calendar = createGoogleClient(tokens);
   let allEvents = [];
   let pageToken = null;

   do {
      const res = await calendar.events.list({
	 calendarId: 'primary',
	 pageToken: pageToken,
	 singleEvents: true,
	 maxResults: 250, // Optimal batch size
      });

      allEvents.push(...res.data.items);
      pageToken = res.data.nextPageToken; // If null, loop ends
   } while (pageToken);

   return allEvents;
};

exports.fetchChangedEvents = async (tenantId) => {
   const integration = await Integration.findOne({ where: { tenantId, provider: 'google' } });
   const tokens = await getTokens(tenantId);
   const calendar = createGoogleClient(tokens);

   let allChanges = [];
   let pageToken = null;
   let newSyncToken = null;

   try {
       do {
	  const params = {
	     calendarId: 'primary',
	     pageToken: pageToken,
	     maxResults: 250,
	  };

	  // If we have a syncToken, use it to get only changes
	  if (integration.syncToken) {
	      params.syncToken = integration.syncToken;
	  } else {
	      // First time sync: list events from a reasonable past date
	      params.timeMin = new Date().toISOString(); 
	  }

          const res = await calendar.events.list(params);
				                
	  allChanges.push(...res.data.items);
	  pageToken = res.data.nextPageToken;
				                
	  // The final page contains the nextSyncToken
	  if (res.data.nextSyncToken) {
	      newSyncToken = res.data.nextSyncToken;
	  }
       } while (pageToken);

       // Update the database with the new token for the next run
       await integration.update({ syncToken: newSyncToken });

       return allChanges;
    } catch (error) {
       // If syncToken is invalid (expired), we must clear it and do a full sync
       if (error.code === 410) {
	   console.log('Sync token expired. Clearing and performing full reset.');
	   await integration.update({ syncToken: null });
	   return this.fetchChangedEvents(tenantId);
       }
       throw error;
    }
};
