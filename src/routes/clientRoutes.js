const express = require('express');
const router = express.Router();

const clientController = require('../controllers/clientController');
const {
    validateLogin,
    validateCalendarEvent,
    validateCreateContact,
    validateCreateClient,
    validateCreateMatter,
    validateCreateProspect,
    validateCreateTask
} = require('../middleware/validateClientRequest');

router.post('/login', validateLogin, clientController.login);
router.post('/client', validateCreateClient, clientController.createClient);
router.get('/client', clientController.getClients);
router.post('/matter', validateCreateMatter, clientController.createMatter);
router.post('/matters', validateCreateMatter, clientController.createMatter);
router.get('/matter-info', clientController.getMatterInfo);
router.post('/standard-event', validateCalendarEvent, clientController.createEvent);
router.post('/all-event', validateCalendarEvent, clientController.createAllDayEvent);
router.post('/contact', validateCreateContact, clientController.createContact);
router.get('/hasValidToken', clientController.isLoginSessionValid);
router.get('/countries', clientController.searchCountries);
router.get('/search-contact', clientController.getContactIdByEmail);
router.get('/case-stage', clientController.getCaseStageInfo);
router.get('/practice-area', clientController.getPracticeAreaInfo);
router.get('/billing-info', clientController.getBillingInfo);
router.get('/billing-types', clientController.getBillingInfo);
router.post('/prospects', validateCreateProspect, clientController.createProspect);
router.get('/lead-sources', clientController.getLeadSources);
router.get('/lead-statuses', clientController.getLeadStatuses);
router.post('/tasks', validateCreateTask, clientController.createTask);
router.get('/task-categories', clientController.getTaskCategories);
router.get('/task-priorities', clientController.getTaskPriorities);
router.get('/task-statuses', clientController.getTaskStatuses);

module.exports = router;
