const moment = require('moment');

const { Op } = require('sequelize'); // Ensure Op is imported from sequelize
const { Event } = require('../models');

const { getTokens, getValidTokens } = require('../services/redisService');

const googleService = require('../services/googleCalendarService');
const connectRabbitMQ = require('../utils/rabbitMQ');

exports.createEvent = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'];
    
    if (!tenantId) {
       console.error("Missing Tenant ID in request");
       return res.status(401).json({ success: false, rror: 'Unauthorized: No Tenant ID' });
    }

    const eventData = { ...req.body, tenantId, provider: 'google' };
    
    const googleToken = await getValidTokens(tenantId);

    if(!googleToken){
       return res.status(400).json({ success: false, error: 'No token found' });
    }	 

    const event = await Event.create(eventData);
    try{
        const gId = await googleService.syncLocalToGoogle(tenantId, event);
	if(gId){
	   await event.update({ providerEventId: gId });
	}    
    }catch(gErr){
	console.error('Google Sync Failed:', gErr.message);
    }	  
    res.status(201).json({ success: true, message: "Event created successfully", data: event });
  }catch(error){
    console.error(error);
    res.status(500).json({ success: false, error: 'Failed to create event' });
  }
};

exports.getAllEvents = async (req, res) => {
  try {	  
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'];

    if (!tenantId) {
        console.error("Missing Tenant ID in request");
        return res.status(401).json({ success: false, error: 'Unauthorized: No Tenant ID' });
    }

    const events = await Event.findAll({ where: { tenantId } });	  
    res.json({ success: true, message: "Event list", data: events });
  } catch (error) {
    console.error('Error getEvents', error);
    res.status(500).json({ success: false, error: 'Failed to fetch events' });
  }
};

exports.getEvents = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'];

    if (!tenantId) {
      console.error("Missing Tenant ID in request");
      return res.status(401).json({ success: false, error: 'Unauthorized: No Tenant ID' });
    }

    // 1. Extract and Parse Pagination Parameters
    // Default to page 1, 10 items per page
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // 2. Use findAndCountAll to get data and total record count
    const { count, rows } = await Event.findAndCountAll({
      where: { tenantId },
      limit: limit,
      offset: offset,
      order: [['startTime', 'DESC']] // Optional: show newest events first
    });

    // 3. Calculate Metadata
    const totalPages = Math.ceil(count / limit);

    res.json({
      success: true,
      message: "Event list",
      data: rows,
      pagination: {
        totalItems: count,
        totalPages: totalPages,
        currentPage: page,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    console.error('Error getEvents', error);
    res.status(500).json({ success: false, error: 'Failed to fetch events' });
  }
};

exports.getEventById = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'];
    const { event_id } = req.params;

    if (!tenantId) {
       console.error("Missing Tenant ID in request");
       return res.status(401).json({ success: false, error: 'Unauthorized: No Tenant ID' });
    }

    const event = await Event.findOne({ where: { id: event_id, tenantId } });
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });
    res.json({ sucess: true, message: "Event details", data: event } );
  } catch (error) {
    console.error('Error getEventById', error);
    res.status(500).json({ success: false, error: 'Failed to fetch event' });
  }
};

exports.getEventsByRange = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'];
    if (!tenantId) {
        return res.status(401).json({ success: false, error: 'Unauthorized: No Tenant ID' });
    }

    // 1. Extract Params including 'search'
    let { startTime, endTime, page = 1, limit = 10, search } = req.query;

    // 2. Dynamic Date Defaults
    const now = new Date();
    if (!startTime) startTime = now.toISOString();
    if (!endTime) {
        const plusTwoDays = new Date(now);
        plusTwoDays.setDate(now.getDate() + 2);
        endTime = plusTwoDays.toISOString();
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    // 3. Validation
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ success: false, error: 'Invalid date format' });
    }
    if (end <= start) {
        return res.status(400).json({ success: false, error: 'endTime must be after startTime' });
    }

    // 4. Construct Where Clause
    const whereClause = {
      tenantId,
      startTime: { [Op.between]: [start, end] }
    };

    // 5. Add Search Logic (if search string is provided)
    if (search && search.trim() !== '') {
      const searchWildcard = `%${search.trim()}%`;
      whereClause[Op.or] = [
        { title: { [Op.like]: searchWildcard } }, 
        { description: { [Op.like]: searchWildcard } }
      ];
    }

    // 6. Pagination & Query
    const pageNumber = Math.max(1, parseInt(page));
    const limitNumber = Math.max(1, parseInt(limit));
    const offset = (pageNumber - 1) * limitNumber;

    const { count, rows } = await Event.findAndCountAll({
      where: whereClause,
      limit: limitNumber,
      offset: offset,
      order: [['startTime', 'ASC']]
    });

    // 7. Headers & Response
    res.set('X-Total-Count', count);
    res.set('Access-Control-Expose-Headers', 'X-Total-Count');

    const _status = rows.length > 0 ? 200: 404;

    res.status(_status).json({
      success: rows.length > 0 ? true : false,
      message: rows.length > 0 ? "Events on date range." : "No event found.",	    
      data: rows,
      pagination: {
        totalItems: count,
        totalPages: Math.ceil(count / limitNumber),
        currentPage: pageNumber,
        pageSize: limitNumber,
        rangeUsed: { start, end },
        searchQuery: search || null
      }
    });

  } catch (error) {
    console.error('Error Fetch Events:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

exports.checkConflicts = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'];

    if (!tenantId) {
        console.error("Missing Tenant ID in request");
	return res.status(401).json({ success: false, error: 'Unauthorized: No Tenant ID' });
    }

    const { startTime, endTime } = req.query; 

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
	return res.status(400).json({ success: false, error: 'Invalid date format provided' });
    }

    const conflicts = await Event.findAll({
      where: {
        tenantId,
        startTime: { [Op.lt]: end },
        endTime: { [Op.gt]: start }
      }
    });

    res.json({
      success: true,	    
      message: conflicts.length > 0 ? 'Conflict exist' : 'No conflict',	    
      hasConflict: conflicts.length > 0,
      conflicts: conflicts
    });
  } catch (error) {
    console.error('Conflict Check Error:', error);
    res.status(500).json({ success: false, error: 'Failed to check conflicts' });
  }
};

exports.updateEvent = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'];
    const { event_id } = req.params;

    const googleToken = await getValidTokens(tenantId);

    if(!googleToken){
       return res.status(400).json({ error: 'No token found' });
    }
	  
    const event = await Event.findOne({ where: { id:  event_id, tenantId } });
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });

    await event.update(req.body);

    // Sync update to Google	  
    if(event.providerEventId) {
       await googleService.syncLocalToGoogle(tenantId, event, event.providerEventId);
    }

    res.json({ success: true, message: 'Event has been updated', data: event } );
  } catch (error) {
    console.error('Error update Event', error);
    res.status(500).json({ success: false, error: 'Failed to update event' });
  }
};

exports.deleteEvent = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'];

    const { event_id } = req.params;

    const googleToken = await getValidTokens(tenantId);

    if(!googleToken){
       return res.status(400).json({ success: false, error: 'No token found' });
    }
	  
    const event = await Event.findOne({ where: { id: event_id, tenantId } });
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });

    // Delete Google event first (or concurrently)
    if(event.google_event_id) {
       await googleService.deleteGoogleEvent(tenantId, event.google_event_id);
    }
	  
    await event.destroy();
    res.json({ success: true, message: 'Event deleted' });
  } catch (error) {
    console.error('Error deleteEvent', error);
    res.status(500).json({ success: false, error: 'Failed to delete event' });
  }
};

exports.syncAllEvents = async (req, res) => {
   try {
     const tenantId = req.user?.tenantId || req.headers['x-tenant-id']; // Derived from your auth middleware

     const channel = await connectRabbitMQ();
     
     if (!channel) {
	 return res.status(500).json({ success: false, error: 'Messaging service unavailable' });
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
	 res.status(500).json({ success: false, error: 'Failed to initiate sync' });
    }
};

exports.disconnectGoogle = async (req, res) => {
   const tenantId = req.user?.tenantId || req.headers['x-tenant-id'];

   const channel = await connectRabbitMQ();

   // Send the revoke command to the worker
   channel.sendToQueue('calendar_sync', Buffer.from(JSON.stringify({
      action: 'REVOKE',
      tenantId: tenantId
   })), { persistent: true });

   res.json({ success: true, message: 'Disconnection initiated.' });
};
