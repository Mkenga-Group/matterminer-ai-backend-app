const express = require('express');
const router = express.Router();

const clientController = require('../controllers/clientController');

router.post('/login', clientController.login);
router.post('/client', clientController.createClient);
router.get('/client', clientController.createClient);
router.get('/hasValidToken', clientController.isLoginSessionValid);

module.exports = router;
