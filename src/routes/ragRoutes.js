const express = require('express');
const router = express.Router();
const ragController = require('../controllers/ragController');

// Secure this route with your existing middleware if necessary
router.get('/lookup', ragController.lookupProtocol);

module.exports = router;
