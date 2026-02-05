const { google } = require('googleapis');
const OAuth2 = google.auth.OAuth2;
require('dotenv').config();

const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

function createConnection() {
   return new OAuth2(
     process.env.GOOGLE_CLIENT_ID,
     process.env.GOOGLE_CLIENT_SECRET,
     REDIRECT_URI
   );
}

require('dotenv').config();

const scopes = [
   'https://www.googleapis.com/auth/calendar',
   'https://www.googleapis.com/auth/calendar.events',
   'https://www.googleapis.com/auth/userinfo.email',
   'https://www.googleapis.com/auth/userinfo.profile'
];

function getAuthUrl(tenantId) {
   const auth = createConnection();
   return auth.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent', // Essential to ensure you always get a refresh_token
      state: tenantId	   
   });
}

async function getTokens(code) {
   const auth = createConnection();
   // The getToken method is what communicates with Google	
   const { tokens } = await auth.getToken(code);
   return tokens;
}

module.exports = { getAuthUrl, getTokens };
