const express = require('express');
const router = express.Router();
const { getAuthUrl: getGoogleAuthUrl, getTokens: getGoogleTokens } = require('../services/googleOAuth');
const { storeTokens, revokeTokens, checkTokenStatus, getValidTokens } = require('../services/redisService');
const { registerCalendarWatch } = require('../services/googleWebhookService');
const walletService = require('../services/walletService');
const auth = require('../middleware/auth');

const jwt = require('jsonwebtoken');

require('dotenv').config();

router.get('/google', (req, res) => {
  try {
    const tenantId = req.query.tenant_id || 'default_tenant';
    const url = getGoogleAuthUrl(tenantId);

    // res.redirect(url);
    res.json({ success: true, data: url, message: 'Google consent URL' });
  } catch (error) {
    const errMsg = error?.message || error.response?.data?.error_description;
    console.error('Error generating Auth URL:', errMsg);
    res.status(500).json({ success: false, message: 'Google consent has failed', details: errMsg });
  }
});

router.get('/oauth2callback', async (req, res) => {
  const code = req.query.code;
  const tenantId = req.query.state || 'default_tenant';

  if (!code) {
    return res.status(400).json({ success: false, message: 'No code provided' });
  }

  try {
    const tokens = await getGoogleTokens(code);

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

    // Create tenant wallet
    await walletService.ensureWalletExists(tenantId);

    res.json({
      success: true,
      message: 'tenant authentication',
      data: {
        accessToken: jwtToken,
        tenantId
      }
    });
  } catch (error) {
    const errMsg = error?.message || error.response?.data?.error_description;
    if (error.response && error.response.data) {
      console.error('Google OAuth Error Response:', error.response.data);
    } else {
      console.error('OAuth Callback Error:', error.message);
    }

    res.status(500).json({ success: false, error: 'Failed to get Google tokens', details: errMsg });
  }
});

router.get('/hasGrantToken', auth, async (req, res) => {
  const tenantId = req.query.tenant_id || 'default_tenant';

  try {

    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'No tenantId provided' });
    }
    const status = await checkTokenStatus(tenantId);

    res.json({
      success: true,
      tenantId,
      ...status,
      message: status.exists
        ? (status.valid ? 'Google Calendar integration is active and valid.' : 'Google Calendar integration exists but session is invalid. Re-authentication required.')
        : 'No Google Calendar integration found for this tenant.'
    });
  } catch (error) {
    console.error('Error checking grant token:', error);
    res.status(500).json({ success: false, message: 'Failed to check token status', details: error.message });
  }
});

router.get('/accessToken', async (req, res) => {
  const tenantId = req.query.tenant_id;

  if (!tenantId) {
    return res.status(400).json({ success: false, message: 'No tenantId provided' });
  }

  try {

    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is not defined in environment variables');
    }

    const jwtToken = jwt.sign(
      { provider: 'matterminer', tenantId: tenantId },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      success: true,
      jwtToken,
      tenantId,
      status: 'ready',
      message: `Access token is valid and session is initialized. You may now proceed to the user's original request.`
    });
  } catch (error) {
    const errMsg = error?.message || error.response?.data?.error_description;

    if (error.response && error.response.data) {
      console.error('Access Token Error Response:', error.response.data || error?.message);
    }

    res.status(500).json({ success: false, message: 'Failed to get access token', details: errMsg });
  }
});

router.post('/googleRefreshToken', auth, async (req, res) => {
  // Extract tenantId from JWT (provided by auth middleware) or fallback to body/query
  const tenantId = req.user?.tenantId || req.body.tenant_id || req.query.tenant_id;

  if (!tenantId) {
    return res.status(400).json({ success: false, message: 'No tenantId found in token or request body' });
  }

  try {
    const tokens = await getValidTokens(tenantId);

    if (tokens) {
      res.json({
        success: true,
        message: 'Google access token is valid (refreshed if necessary)',
        tenantId
      });
    } else {
      res.status(401).json({
        success: false,
        message: 'No valid refresh token found. User must re-authenticate.'
      });
    }
  } catch (error) {
    console.error('Error in /googleRefreshToken:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to refresh token for Google Calendar',
      details: error.message
    });
  }
});

router.post('/logout', async (req, res) => {
  try {
    const tenantId = req.body.tenant_id;

    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'No tenantId provided' });
    }
    await revokeTokens(tenantId);
    res.json({ message: "Logged out successfully and tokens cleared." });
  } catch (error) {
    const errMsg = error?.message || error.response?.data?.error_description;
    res.status(500).json({ success: false, message: "Logout failed", details: errMsg });
  }
});

module.exports = router;
