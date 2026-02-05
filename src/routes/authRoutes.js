const express = require('express');
const router = express.Router();
const { getAuthUrl: getGoogleAuthUrl, getTokens: getGoogleTokens } = require('../services/googleOAuth');
const { storeTokens } = require('../services/redisService');
const { registerCalendarWatch } = require('../services/googleWebhookService');

const jwt = require('jsonwebtoken');

require('dotenv').config();

router.get('/google', (req, res) => {
   try {
       const tenantId = req.query.tenantId || 'default_tenant';
       const url = getGoogleAuthUrl(tenantId);

       res.redirect(url);
   } catch (error) { 
       console.error('Error generating Auth URL:', error.message);
       res.status(500).json({ error: 'Internal Server Error' });
   }
});

router.get('/oauth2callback', async (req, res) => {
  const code = req.query.code;
  const tenantId = req.query.state || 'default_tenant';
	
  if(!code) {
     return res.status(400).json({ error: 'No code provided' });
  }

  try { 
      const tokens = await getGoogleTokens(code);
      console.log('Successfully retrieved tokens:', tokens);

      // Store in redis per tenancy	  
      await storeTokens(tenantId, tokens);
      // REGISTER THE WEBHOOK (The "Watch")
      // This creates the Integration record and tells Google to ping us
      //await registerCalendarWatch(tenantId);	  

      if (!process.env.JWT_SECRET) {
	  throw new Error('JWT_SECRET is not defined in environment variables');
      }

      const jwtToken = jwt.sign(
        { provider: 'google', tenantId: tenantId }, 
	process.env.JWT_SECRET, 
        { expiresIn: '1h' }
      );

      res.json({ 
          success: true,
	  jwtToken, 
	  tenantId    
	  //tokens 
      });
   } catch (error) {
      if (error.response && error.response.data) {
	  console.error('Google OAuth Error Response:', error.response.data);
      } else {
	  console.error('OAuth Callback Error:', error.message);
      }

      res.status(500).json({ error: 'Failed to get Google tokens', details: error.response?.data?.error_description || error.message });
   }
});

module.exports = router;
