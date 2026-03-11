const express = require('express');
const router = express.Router();
const chatSessionController = require('../controllers/chatSessionController');
const auth = require('../middleware/auth');

// Protected routes for managing chat sessions
router.post('/session', auth, chatSessionController.createChatSession);
router.get('/session', auth, chatSessionController.getChatSession);
router.delete('/session', auth, chatSessionController.deleteChatSession);

module.exports = router;
