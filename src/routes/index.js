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

router.use('/events', eventRoutes);
router.use('/auth', authRoutes);
router.use('/rag/lookup', ragRoutes);

router.use('/webhook', externalApiLimiter, basicAuth, webhookRoutes);
router.use('/wallet', walletRoutes);
router.use('/chat', chatSessionRoutes);
router.use('/core', clientRoutes);

// Placeholder for routes
router.get('/health', (req, res) => {
  res.json({ success: true, message: 'Calendar Service API | wallet API' });
});

module.exports = router;
