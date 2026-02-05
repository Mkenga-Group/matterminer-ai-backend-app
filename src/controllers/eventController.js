
const { Event } = require('../models');
const googleService = require('../services/googleCalendarService');

exports.createEvent = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const eventData = { ...req.body, tenantId };
    const event = await Event.create(eventData);
    try{
        const gId = await googleService.syncLocalToGoogle(tenantId, event);
	if(gId){
	   await event.update({ providerEventId: gId });
	}    
    }catch(gErr){
	console.error('Google Sync Failed:', gErr.message);
    }	  
    res.status(201).json(event);
  }catch(error){
      console.error(error);
      res.status(500).json({ error: 'Failed to create event' });
  }
};

exports.getEvents = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const events = await Event.findAll({ where: { tenantId } });
    res.json(events);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
};

exports.getEventById = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { id } = req.params;
    const event = await Event.findOne({ where: { id, tenantId } });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json(event);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch event' });
  }
};

exports.updateEvent = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { id } = req.params;
    const event = await Event.findOne({ where: { id, tenantId } });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    await event.update(req.body);

    // Sync update to Google	  
    if(event.providerEventId) {
       await googleService.syncLocalToGoogle(tenantId, event, event.providerEventId);
    }

    res.json(event);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update event' });
  }
};

exports.deleteEvent = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { id } = req.params;
    const event = await Event.findOne({ where: { id, tenantId } });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    // Delete Google event first (or concurrently)
    if(event.google_event_id) {
       await googleService.deleteGoogleEvent(tenantId, event.google_event_id);
    }
	  
    await event.destroy();
    res.json({ message: 'Event deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
};

exports.syncAllEvents = async (req, res) => {
   try {
     const tenantId = req.user.tenantId; // Derived from your auth middleware
     const channel = await connectRabbitMQ();
     
     if (!channel) {
	 return res.status(500).json({ error: 'Messaging service unavailable' });
     }

     const payload = {
         action: 'FULL_SYNC',
	 tenantId: tenantId
     };

     channel.sendToQueue('calendar_sync', Buffer.from(JSON.stringify(payload)), {
         persistent: true
     });

     res.json({ 
	 success: true, 
         message: 'Syncing your Google Calendar in the background. Please refresh in a moment.' 
     });
    } catch (error) {
	 console.error('Sync Error:', error);
	 res.status(500).json({ error: 'Failed to initiate sync' });
    }
};

exports.disconnectGoogle = async (req, res) => {
   const tenantId = req.user.tenantId;
   const channel = await connectRabbitMQ();

   // Send the revoke command to the worker
   channel.sendToQueue('calendar_sync', Buffer.from(JSON.stringify({
      action: 'REVOKE',
      tenantId: tenantId
   })), { persistent: true });

   res.json({ success: true, message: 'Disconnection initiated.' });
};
