// src/routes/wallet.routes.js
const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');

router.get('/check-balance', walletController.checkSufficientBalance);
router.post('/deplete', walletController.trackUsage);

module.exports = router;
