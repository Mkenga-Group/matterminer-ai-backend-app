const express = require('express');
const router = express.Router();

const eventRoutes = require('./eventRoutes');
const authRoutes = require('./authRoutes');
const webhookRoutes = require('./webhookRoutes');
const walletRoutes = require('./walletRoutes');;

router.use('/events', eventRoutes);
router.use('/auth', authRoutes);
router.use('/webhook',webhookRoutes);
router.use('/wallet', walletRoutes);

// Placeholder for routes
router.get('/health', (req,res) => {
  res.json({ success: true, message: 'Calendar Service API | wallet API' });
});

module.exports = router;
