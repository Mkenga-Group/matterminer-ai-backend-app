const express = require('express');
const router = express.Router();

const eventRoutes = require('./eventRoutes');
const authRoutes = require('./authRoutes');
const webhookRoutes = require('./webhookRoutes');
const walletRoutes = require('./walletRoutes');
const ragRoutes = require('./ragRoutes');
const chatSessionRoutes = require('./chatSessionRoutes');
const clientRoutes = require('./clientRoutes');

router.use('/events', eventRoutes);
router.use('/auth', authRoutes);
router.use('/rag/lookup', ragRoutes);
router.use('/webhook', webhookRoutes);
router.use('/wallet', walletRoutes);
router.use('/chat', chatSessionRoutes);
//router.use('/chat', chatSessionRoutes);
router.use('/core', clientRoutes);

// Placeholder for routes
router.get('/health', (req, res) => {
  res.json({ success: true, message: 'Calendar Service API | wallet API' });
});

module.exports = router;
