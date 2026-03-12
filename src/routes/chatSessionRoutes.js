const express = require('express');
const router = express.Router();

const chatSessionController = require('../controllers/chatSessionController');

router.post('/session', chatSessionController.syncChatSession);
router.get('/session', chatSessionController.getChatSession);
router.get('/sessions/pending', chatSessionController.getPendingSessions);
router.delete('/session', chatSessionController.clearChatSession);

module.exports = router;