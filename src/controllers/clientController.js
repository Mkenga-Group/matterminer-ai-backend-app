

const { Client, ChatSession } = require('../models');

const { apiRequest } = require('../utils/apiHelper');

const { storeCoreLogin,getCoreLogin } = require('../services/redisService');

//const CORE_SERVICE_BASE_URL = 'https://dev.matterminer.com/api/login';

exports.createEvent = async (req, res) => {
    const { tenantId, title, start_datetime, end_datetime, description, location, timezone, visibility, status, attendees } = req.body;
    const email = req.headers['x-user-email'];
    try {

        if(!email){
            return res.status(400).json({
                success: false,
                message: "Email must be provided"
            });
        }

        const hasAccessToken = await getCoreLogin(email);	
        if(!hasAccessToken){
           return res.status(404).json({
               success: false,
               message: "Not found"
           });
        }
	    
        const payload = {
           title,
           start_datetime,
           end_datetime,
           description: `${description} \npowered by Nuru`,
           location,
           timezone,
           is_all_day: false,
           matter_id: null,
           visibility: "private",
           status: "confirmed",
           attendees,
           reminders: [
             {             
                method: "email",
                minutes: 60
             },
             {
                method: "popup",
                minutes: 15
             }
          ]
        }

        const result = await apiRequest(`${process.env.CORE_SERVICE_BASE_URL}/api/calendar`, 'post', payload, {}, hasAccessToken.access_token);

        if (result.status === 200 || result.status === 201) {
            //-. Cleanup chat session
            await ChatSession.destroy({ where: { tenantId } });
            return res.status(200).json({
                success: true,
                message: result?.message || `Event has been created`
            });
        }else{
            return res.status(401).json({
                success: false,
                message: result?.message || `Failed to create an event`
            });
        }
    } catch (error) {
        console.error("Error finalizing client:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to save permanent client record."
        });
    }
};

exports.createAllDayEvent = async (req, res) => {
    const { tenantId, title, start_datetime, end_datetime, description } = req.body;
    const email = req.headers['x-user-email'];

    try {

        if(!email){
            return res.status(400).json({
                success: false,
                message: "Email must be provided"
            });
        }

        const hasAccessToken = await getCoreLogin(email);
        if(!hasAccessToken){
           return res.status(404).json({
               success: false,
               message: "Not found"
           });
        }

        const payload = {
           title,
           start_datetime,
           end_datetime,
           description: `${description} \npowered by Nuru`,
           is_all_day: true,
           matter_id: null,
           visibility: "private",
           status: "confirmed",
           reminders: [
             {
                method: "email",
                minutes: 1440
             }
          ]
        }

        const result = await apiRequest(`${process.env.CORE_SERVICE_BASE_URL}/api/calendar`, 'post', payload, {}, hasAccessToken.access_token);

        if (result.status === 200 || result.status === 201) {
            //-. Cleanup chat session
            await ChatSession.destroy({ where: { tenantId } });
            return res.status(200).json({
                success: true,
                message: result?.message || `Event has been created`
            });
        }else{
            return res.status(401).json({
                success: false,
                message: result?.message || `Failed to create an event`
            });
        }
    } catch (error) {
        console.error("Error finalizing client:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to save permanent client record."
        });
    }
};

exports.createContact = async (req, res) => {
    const { tenantId, title, first_name, middle_name, last_name, contact_email, country_code, phone_number } = req.body;
    const email = req.headers['x-user-email'];

    try {
        
        if(!email){
            return res.status(400).json({
                success: false,
                message: "Email must be provided"
            });
        }

        const hasAccessToken = await getCoreLogin(email);
        if(!hasAccessToken){
           return res.status(404).json({
               success: false,
               message: "Not found"
           });
        }	    
        // 1. Create a log record
	const payload = { 
           contact_type: "primary",
           title,
           first_name,
           middle_name,
           last_name,
	   email: contact_email,
           country_code,
	   phone_number,
           model_type: "App\\Models\\Prospect",
	   model_id: 1,
	   active: true,
	   featured: false
	};

        const result = await apiRequest(`${process.env.CORE_SERVICE_BASE_URL}/api/contacts`, 'post', payload, {}, hasAccessToken.access_token);
        console.log(result);
        if (result.status === 200 || result.status === 201) {	
            //-. Cleanup chat session
            await ChatSession.destroy({ where: { tenantId } });
            return res.status(200).json({
                success: true,
                message: result?.message || `Contact has been created`
            });
        }else{
            return res.status(401).json({
                success: false,
                message: result?.message || `Failed to create a contact`
            });
        }
    } catch (error) {
        console.error("Error finalizing client:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to save permanent client record."
        });
    }
};

exports.createClient = async (req, res) => {
    const { tenantId, first_name, last_name, client_type, client_email, country_id, street } = req.body;
    const email = req.headers['x-user-email'];
   
    try {

        if(!email){
            return res.status(400).json({
                success: false,
                message: "Email must be provided"
            });
        }

        // 1. Create a log record
        const payload = {
           first_name, 
           last_name, 
           client_type, 
	   email: client_email,
           country_id,
	   street,
           contact_id: 2
        }

        const hasAccessToken = await getCoreLogin(email);
	    
        if(!hasAccessToken){
           return res.status(404).json({
               success: false,
               message: "Not found"
           });
        }
       
        const result = await apiRequest(`${process.env.CORE_SERVICE_BASE_URL}/api/clients`, 'post', payload, {}, hasAccessToken.access_token);

        if (result.status === 200 || result.status === 201){
            //-. Cleanup chat session		
            await ChatSession.destroy({ where: { tenantId } });
            return res.status(200).json({
                success: true,
                message: result?.message || `Client has been created`
            });
        }else{
            return res.status(400).json({
                success: false,
                message: result?.message || `Failed to create a client`
            });
        }
    } catch (error) {
        console.error("Error finalizing client:", error);
        return res.status(500).json({ 
            success: false, 
            message: "Failed to save permanent client record." 
        });
    }
};

exports.createMatter = async (req, res) => {
    const { tenantId, full_name, phone, address } = req.body;
    const email = req.headers['x-user-email'];

    try {

        if(!email){
            return res.status(400).json({
                success: false,
                message: "Email must be provided"
            });
        }

        const hasAccessToken = await getCoreLogin(email);
        if(!hasAccessToken){
           return res.status(404).json({
               success: false,
               message: "Not found"
           });
        }

        // 1. Create a log record
        const payload = {
            tenantId, full_name, email, phone, address
        };

        const result = await apiRequest(`${process.env.CORE_SERVICE_BASE_URL}/api/matters`, 'post', payload, {}, hasAccessToken.access_token);

        if (result.status === 200 || result.status === 201) {
            //-. Cleanup chat session
            await ChatSession.destroy({ where: { tenantId } });
            return res.status(200).json({
                success: true,
                message: result?.message || `Matter has been created`
            });
        }else{
            return res.status(400).json({
                success: false,
                message: result?.message || `Failed to create a matter`
            });
        }
    } catch (error) {
        console.error("Error finalizing client:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to save permanent client record."
        });
    }
};

exports.login = async (req, res) => {
    const { email, password } = req.body;

    try {
        if(!email || !password){
            return res.status(400).json({
                success: false,
                message: "Email or Password must be provided"
            });
        }

        const payload = {
            email,
            password
	};
       	   
        const result = await apiRequest(`${process.env.CORE_SERVICE_BASE_URL}/api/login`, 'post', payload);

	if (result.status === 200) {
            const _message = result.data.message;		
            const _access_token = result.data.token.access_token;		
            await storeCoreLogin(email,{ access_token: _access_token, set_time: new Date() });	
	    return res.status(200).json({
                success: true,
		access_token: _access_token,    
                message: _message
            });
	}else{
            return res.status(401).json({
                success: false,
		message: result.message    
	    });
	}
    } catch (error) {
        console.error("Error authentication:", error);
        return res.status(500).json({
            success: false,
            access_token: null,		
            message: "Authentication has failed."
        });
    }
};

exports.isLoginSessionValid = async(req, res) => {
    const email = req.headers['x-user-email'] || req.query.email;
    try{
        if(!email){
            return res.status(400).json({
                success: false,
                message: "Email must be provided"
            });
        } 
	 
	const hasAccessToken = await getCoreLogin(email);    
	if(!hasAccessToken){
           return res.status(404).json({
	       success: false,
	       message: "Not found"          
	   });
	}    
        return res.status(200).json({
            success: true,
            access_token: hasAccessToken.access_token,		
            message: "Active access token found"
        });
    }catch(error){
        console.error("Error isLoginSessValid:", error);
        return res.status(500).json({
            success: false,
            message: "No access token."
        });
    }
};

exports.searchCountries = async(req, res) => {
    try {
      const email = req.headers['x-user-email'];
      const { page, per_page, search, sort_by, sort_order } = req.query;

      // 2. Call the utility method we created
      // We pass these as an object to the filters parameter
      const queryParams = {
        page: page || 1,
        per_page: per_page || 15,
        search: search || 'Kenya',
        sort_by: sort_by || 'created_at',
        sort_order: sort_order || 'desc'
      };

      const params = new URLSearchParams({
          page,
          per_page,
          search,
          sort_by,
          sort_order
      }); 
   
      const hasAccessToken = await getCoreLogin(email);
      if(!hasAccessToken){
         return res.status(404).json({
             success: false,
             message: "Not found"
         });
      }	    

      const result = await apiRequest(`${process.env.CORE_SERVICE_BASE_URL}/api/countries?${params.toString()}`, 'get', null, {}, hasAccessToken.access_token);	    
      if (result.status === 200) {
	  console.log({ success: true, country_id: result.data.data[0].id, message: 'Retreived country id successfully' });     
         return res.status(200).json({
             success: true,
             country_id: result.data.data[0].id,
             message: 'Retreived country id successfully'
         });
      }else{
         return res.status(400).json({
             success: false,
             message: result?.message || `Failed get the country id`
         });
      }   
    } catch (error) {
      // 4. Global Catch for unexpected server errors
      console.error('Error in clientController.searchCountries:', error);
      return res.status(500).json({
        success: false,
        error: true,
        message: `Internal Server Error: ${error.message}`
      });
    }
};

exports.getContactIdByEmail = async(req,res) => {
    try {
      const email = req.headers['x-user-email'];
      const { tenantId,search_email, page, per_page, search, sort_by, sort_order } = req.query;
    
      const queryParams = {
        page: page || 1,
        per_page: per_page || 15,
        search: search_email || '',
        sort_by: sort_by || 'created_at',
        sort_order: sort_order || 'desc'
      };

      const params = new URLSearchParams({
          page,
          per_page,
          search,
          sort_by,
          sort_order
      });	    

      const hasAccessToken = await getCoreLogin(email);
      if(!hasAccessToken){
         return res.status(404).json({
             success: false,
             message: "Not found"
         });
      }

      const result = await apiRequest(`${process.env.CORE_SERVICE_BASE_URL}/api/contacts?${params.toString()}`, 'get', {}, null, hasAccessToken.access_token);
      if (result.status === 200) {
	  let _id = null;
	   _id = result.data.data[0].id;
	  if(_id){
             return res.status(200).json({
                success: true,
                contact_id: result.data.data[0].id ? result.data.data[0].id : 0,		  
                message: result?.message || `Contact id`
             });
	  }else{
              return res.status(404).json({
                  success: false,
		  contact_id: null,
		  message: 'Contact Id not found'     
	      });
	  }
      }else{
          return res.status(400).json({
             success: false,
             message: result?.message || `Failed to retrieve contact id`
          });
      }
    } catch (error) {
      // 4. Global Catch for unexpected server errors
      console.error('Error in clientController.getContactIdByEmail:', error);
      return res.status(500).json({
         success: false,
         error: true,
         message: `Internal Server Error: ${error.message}`
      });
    }
};
