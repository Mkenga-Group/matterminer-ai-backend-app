const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const eventController = require('../controllers/eventController');

//router.use(auth);

router.post('/', auth, eventController.createEvent);
router.get('/', auth, eventController.getEvents);
//router.get('/:event_id', eventController.getEventById);
router.get('/event-range', auth, eventController.getEventsByRange);
router.get('/check-conflicts', auth, eventController.checkConflicts);
router.patch('/:event_id', auth, eventController.updateEvent);
router.delete('/:event_id', auth, eventController.deleteEvent);
router.post('/sync-google', auth, eventController.syncAllEvents);

module.exports = router;
