const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const basicAuth = require('../middleware/basicAuth');

const eventRoutes = require('./eventRoutes');
const authRoutes = require('./authRoutes');
const webhookRoutes = require('./webhookRoutes');
const walletRoutes = require('./walletRoutes');
const ragRoutes = require('./ragRoutes');
const chatSessionRoutes = require('./chatSessionRoutes');
const clientRoutes = require('./clientRoutes');

// Create a strict rate limiter for external authentication attempts
const externalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Strict limit: 20 requests per IP per 15 minutes
  message: { success: false, message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const v1Router = express.Router();

v1Router.use('/events', eventRoutes);
v1Router.use('/auth', authRoutes);
v1Router.use('/rag/lookup', ragRoutes);

v1Router.use('/webhook', externalApiLimiter, basicAuth, webhookRoutes);
v1Router.use('/wallet', walletRoutes);
v1Router.use('/chat', chatSessionRoutes);
v1Router.use('/core', clientRoutes);

// Mount the v1 router
router.use('/v1', v1Router);

// Keep healthcheck unversioned at /app/health for Docker
router.get('/health', (req, res) => {
  res.json({ success: true, message: 'Calendar Service API | wallet API' });
});

module.exports = router;
