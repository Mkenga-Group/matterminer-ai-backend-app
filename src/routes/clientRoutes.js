const express = require('express');
const router = express.Router();

const clientController = require('../controllers/clientController');

router.post('/login', clientController.login);
router.post('/client', clientController.createClient);
router.get('/client', clientController.createClient);
router.post('/standard-event', clientController.createEvent);
router.post('/all-event', clientController.createAllDayEvent);
router.post('/contact', clientController.createContact);
router.get('/hasValidToken', clientController.isLoginSessionValid);
router.get('/countries', clientController.searchCountries);
router.get('/search-contact', clientController.getContactIdByEmail);
router.get('/case-stage', clientController.getCaseStageInfo);
router.get('/practice-area', clientController.getPracticeAreaInfo);
router.get('/billing-info', clientController.getBillingInfo);
router.post('/prospects', clientController.createProspect);
router.get('/lead-sources', clientController.getLeadSources);
router.get('/lead-statuses', clientController.getLeadStatuses);

module.exports = router;
