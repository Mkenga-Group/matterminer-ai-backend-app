

const { Client, ChatSession } = require('../models');

const { apiRequest } = require('../utils/apiHelper');

const { storeCoreLogin, getCoreLogin } = require('../services/redisService');

//const CORE_SERVICE_BASE_URL = 'https://dev.matterminer.com/api/login';

const API_KEY = process.env.CORE_API_KEY;

exports.createEvent = async (req, res) => {
    const { title, start_datetime, end_datetime, description, location, timezone, visibility, status, attendees } = req.body;
    const email = req.headers['x-user-email'];
    const tenantId = req.headers['x-tenant-id'] || req.body.tenantId;

    try {
        if (!tenantId || tenantId === 'null') {
            return res.status(400).json({
                success: false,
                message: "Tenant ID must be provided"
            });
        }

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email must be provided"
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

        const result = await apiRequest(`${process.env.CORE_SERVICE_BASE_URL}/api/calendar`, 'post', payload, {}, process.env.CORE_API_KEY, tenantId);

        if (result.status === 200 || result.status === 201) {
            console.log('DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD ', tenantId);
            //-. Cleanup chat session
            await ChatSession.destroy({ where: { tenantId } });
            return res.status(200).json({
                success: true,
                message: result?.message || `Event has been created`
            });
        } else {
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
    const { title, start_datetime, end_datetime, description } = req.body;
    const email = req.headers['x-user-email'];
    const tenantId = req.headers['x-tenant-id'] || req.body.tenantId;

    try {
        if (!tenantId || tenantId === 'null') {
            return res.status(400).json({
                success: false,
                message: "Tenant ID must be provided"
            });
        }

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email must be provided"
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
        console.log('[LOG]      PAYLOAD ', payload, '       ', process.env.CORE_API_KEY);
        const result = await apiRequest(`${process.env.CORE_SERVICE_BASE_URL}/api/calendar`, 'post', payload, {}, process.env.CORE_API_KEY, tenantId);
        console.log('HHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH ', result);
        if (result.status === 200 || result.status === 201) {
            //-. Cleanup chat session
            await ChatSession.destroy({ where: { tenantId } });
            return res.status(200).json({
                success: true,
                message: result?.message || `Event has been created`
            });
        } else {
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
    const { title, contact_type, first_name, middle_name, last_name, client_email, country_code, phone_number } = req.body;
    const email = req.headers['x-user-email'];
    const tenantId = req.headers['x-tenant-id'] || req.body.tenantId;

    try {
        if (!tenantId || tenantId === 'null') {
            return res.status(400).json({
                success: false,
                message: "Tenant ID must be provided"
            });
        }

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email must be provided"
            });
        }

        // 1. Create a log record
        const payload = {
            contact_type,
            title,
            first_name,
            middle_name,
            last_name,
            email: client_email,
            country_code: `${country_code}`,
            phone_number,
            model_type: "App\\Models\\Prospect",
            model_id: 1,
            active: true,
            featured: false
        };

        console.log('[LOG]      PAYLOAD ', payload, '       ', process.env.CORE_API_KEY);

        //const result = await apiRequest(`${process.env.CORE_SERVICE_BASE_URL}/api/contacts`, 'post', payload, {}, process.env.CORE_API_KEY, tenantId);
        const result = { status: 201, message: 'Contact has been created.' };

        if (result.status === 200 || result.status === 201) {
            //-. Cleanup chat session
            await ChatSession.destroy({ where: { tenantId } });
            return res.status(200).json({
                success: true,
                message: result?.message || `Contact has been created`
            });
        } else {
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
    const { first_name, last_name, client_type, client_email, contact_id, country_id, street } = req.body;
    const email = req.headers['x-user-email'];
    const tenantId = req.headers['x-tenant-id'] || req.body.tenantId;

    try {
        if (!tenantId || tenantId === 'null') {
            return res.status(400).json({
                success: false,
                message: "Tenant ID must be provided"
            });
        }

        if (!email) {
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
            contact_id
        }

        const result = await apiRequest(`${process.env.CORE_SERVICE_BASE_URL}/api/clients`, 'post', payload, {}, process.env.CORE_API_KEY, tenantId);

        if (result.status === 200 || result.status === 201) {
            //-. Cleanup chat session		
            await ChatSession.destroy({ where: { tenantId } });
            return res.status(200).json({
                success: true,
                message: result?.message || `Client has been created`
            });
        } else {
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
    const { full_name, phone, address } = req.body;
    const email = req.headers['x-user-email'];
    const tenantId = req.headers['x-tenant-id'] || req.body.tenantId;

    try {
        if (!tenantId || tenantId === 'null') {
            return res.status(400).json({
                success: false,
                message: "Tenant ID must be provided"
            });
        }

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email must be provided"
            });
        }

        // 1. Create a log record
        const payload = {
            tenantId, full_name, email, phone, address
        };

        const result = await apiRequest(`${process.env.CORE_SERVICE_BASE_URL}/api/matters`, 'post', payload, {}, process.env.CORE_API_KEY, tenantId);

        if (result.status === 200 || result.status === 201) {
            //-. Cleanup chat session
            await ChatSession.destroy({ where: { tenantId } });
            return res.status(200).json({
                success: true,
                message: result?.message || `Matter has been created`
            });
        } else {
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
        if (!email || !password) {
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
            await storeCoreLogin(email, { access_token: _access_token, set_time: new Date() });
            return res.status(200).json({
                success: true,
                access_token: _access_token,
                message: _message
            });
        } else {
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

exports.isLoginSessionValid = async (req, res) => {
    const email = req.headers['x-user-email'] || req.query.email;
    try {
        if (!tenantId || tenantId === 'null') {
            return res.status(400).json({
                success: false,
                message: "Tenant ID must be provided"
            });
        }

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email must be provided"
            });
        }

        const hasAccessToken = await getCoreLogin(email);
        if (!hasAccessToken) {
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
    } catch (error) {
        console.error("Error isLoginSessValid:", error);
        return res.status(500).json({
            success: false,
            message: "No access token."
        });
    }
};

exports.searchCountries = async (req, res) => {
    try {
        const email = req.headers['x-user-email'];
        const tenantId = req.headers['x-tenant-id'] || req.query.tenantId;
        const { page, per_page, search, sort_by, sort_order } = req.query;

        if (!tenantId || tenantId === 'null') {
            return res.status(400).json({
                success: false,
                message: "Tenant ID must be provided"
            });
        }

        // 2. Call the utility method we created
        // We pass these as an object to the filters paramet
        const params = new URLSearchParams({
            page: page || 1,
            per_page: per_page || 15,
            search: search || 'Kenya',
            sort_by: sort_by || 'created_at',
            sort_order: sort_order || 'desc'
        });

        const result = await apiRequest(`${process.env.CORE_SERVICE_BASE_URL}/api/countries?${params}`, 'get', null, {}, process.env.CORE_API_KEY, tenantId);
        if (result.status === 200) {
            console.log({ success: true, country_id: result.data.data[0].id, message: 'Retreived country id successfully' });
            return res.status(200).json({
                success: true,
                country_id: result.data.data[0].id,
                message: 'Retreived country id successfully'
            });
        } else {
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

exports.getContactIdByEmail = async (req, res) => {
    try {
        const email = req.headers['x-user-email'];
        const tenantId = req.headers['x-tenant-id'] || req.query.tenantId;
        const { page, per_page, search, sort_by, sort_order } = req.query;

        if (!tenantId || tenantId === 'null') {
            return res.status(400).json({
                success: false,
                message: "Tenant ID must be provided"
            });
        }

        const params = new URLSearchParams({
            page: page || 1,
            per_page: per_page || 15,
            search: search || '',
            sort_by: sort_by || 'created_at',
            sort_order: sort_order || 'desc'
        });


        const urlParams = `${process.env.CORE_SERVICE_BASE_URL}/api/contacts?${params}`;

        const result = await apiRequest(urlParams, 'get', {}, null, process.env.CORE_API_KEY, tenantId);
        if (result.status === 200) {
            let _id = null;
            _id = result.data.data[0].id;
            if (_id) {
                return res.status(200).json({
                    success: true,
                    contact_id: _id,
                    message: result?.message || `Contact id`
                });
            } else {
                return res.status(404).json({
                    success: false,
                    contact_id: null,
                    message: 'Contact Id not found'
                });
            }
        } else {
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

exports.getCaseStageInfo = async (req, res) => {
    try {
        const email = req.headers['x-user-email'];
        const tenantId = req.headers['x-tenant-id'] || req.query.tenantId;
        const { page, per_page, search, sort_by, sort_order, is_search = 0 } = req.query;

        if (!tenantId || tenantId === 'null') {
            return res.status(400).json({
                success: false,
                message: "Tenant ID must be provided"
            });
        }

        // 2. Call the utility method we created
        // We pass these as an object to the filters paramet
        const params = new URLSearchParams({
            page: page || 1,
            per_page: per_page || 15,
            search: search || '',
            sort_by: sort_by || 'created_at',
            sort_order: sort_order || 'desc'
        });

        const result = await apiRequest(`${process.env.CORE_SERVICE_BASE_URL}/api/case-stages?${params}`, 'get', null, {}, process.env.CORE_API_KEY, tenantId);
        if (result.status === 200) {
            const apiData = result.data.data || [];
            if (parseInt(is_search) === 1) {
                return res.status(200).json({
                    success: true,
                    case_stage_id: apiData[0]?.id,
                    //practice_area_id: apiData[0]?.practice_area_id,   
                    message: 'Retreive case stage id successfully'
                });
            } else {
                const caseStage = apiData.map(item => ({
                    id: item.id,
                    name: item.name
                }));
                return res.status(200).json({
                    success: true,
                    data: caseStage,
                    message: 'Retreived case stage or practise area'
                });
            }
        } else {
            return res.status(400).json({
                success: false,
                message: result?.message || `Failed get the country id`
            });
        }
    } catch (error) {
        // 4. Global Catch for unexpected server errors
        console.error('Error in clientController.getCaseStageInfo:', error);
        return res.status(500).json({
            success: false,
            error: true,
            message: `Internal Server Error: ${error.message}`
        });
    }
};

exports.getPracticeAreaInfo = async (req, res) => {
    try {
        const email = req.headers['x-user-email'];
        const tenantId = req.headers['x-tenant-id'] || req.query.tenantId;
        const { page, per_page, search, sort_by, sort_order, is_search = 0 } = req.query;

        if (!tenantId || tenantId === 'null') {
            return res.status(400).json({
                success: false,
                message: "Tenant ID must be provided"
            });
        }

        // 2. Call the utility method we created
        // We pass these as an object to the filters paramet
        const params = new URLSearchParams({
            page: page || 1,
            per_page: per_page || 15,
            search: search || '',
            sort_by: sort_by || 'created_at',
            sort_order: sort_order || 'desc'
        });

        const result = await apiRequest(`${process.env.CORE_SERVICE_BASE_URL}/api/practice-areas?${params}`, 'get', null, {}, process.env.CORE_API_KEY, tenantId);
        if (result.status === 200) {
            const apiData = result.data.data || [];
            console.log('KKKKKKKK ', apiData);
            if (parseInt(is_search) === 1) {
                return res.status(200).json({
                    success: true,
                    practice_area_id: apiData[0]?.id,
                    //practice_area_id: apiData[0]?.practice_area_id,
                    message: 'Retreive case stage id successfully'
                });
            } else {
                const caseStage = apiData.map(item => ({
                    id: item.id,
                    name: item.name
                }));
                return res.status(200).json({
                    success: true,
                    data: caseStage,
                    message: 'Retreived practise area'
                });
            }
        } else {
            return res.status(400).json({
                success: false,
                message: result?.message || `Failed get the country id`
            });
        }
    } catch (error) {
        // 4. Global Catch for unexpected server errors
        console.error('Error in clientController.getPracticeAreaInfo:', error);
        return res.status(500).json({
            success: false,
            error: true,
            message: `Internal Server Error: ${error.message}`
        });
    }
};

exports.getBillingInfo = async (req, res) => {
    try {
        const email = req.headers['x-user-email'];
        const tenantId = req.headers['x-tenant-id'] || req.query.tenantId;
        const { page, per_page, search, sort_by, sort_order, is_search = 0 } = req.query;

        if (!tenantId || tenantId === 'null') {
            return res.status(400).json({
                success: false,
                message: "Tenant ID must be provided"
            });
        }

        // 2. Call the utility method we created
        // We pass these as an object to the filters paramet
        const params = new URLSearchParams({
            page: page || 1,
            per_page: per_page || 15,
            search: search || '',
            sort_by: sort_by || 'created_at',
            sort_order: sort_order || 'desc'
        });

        const result = await apiRequest(`${process.env.CORE_SERVICE_BASE_URL}/api/billing-types?${params}`, 'get', null, {}, process.env.CORE_API_KEY, tenantId);
        if (result.status === 200) {
            const apiData = result.data.data || [];
            if (parseInt(is_search) === 1) {
                console.log({ success: true, billing_type_id: apiData, message: 'Retreived billing_type_id successfully' });
                return res.status(200).json({
                    success: true,
                    billing_type_id: apiData[0]?.id,
                    message: 'Retreived billing_type_id successfully'
                });
            } else {
                const billingTypes = apiData.map(item => ({
                    id: item.id,
                    name: item.name
                }));
                return res.status(200).json({
                    success: true,
                    data: billingTypes,
                    message: 'Billing types retrieved successfully'
                });
            }
        } else {
            return res.status(400).json({
                success: false,
                message: result?.message || `Failed to retrieve billing info`
            });
        }
    } catch (error) {
        // 4. Global Catch for unexpected server errors
        console.error('Error in clientController.getBillingInfo:', error);
        return res.status(500).json({
            success: false,
            error: true,
            message: `Internal Server Error: ${error.message}`
        });
    }
};

exports.createProspect = async (req, res) => {
    // Note: AI Agent maps email to client_email
    const { client_type, first_name, last_name, client_email, lead_source_id, lead_status_id } = req.body;
    const email = req.headers['x-user-email'];
    const tenantId = req.headers['x-tenant-id'] || req.body.tenantId;

    try {
        if (!tenantId || tenantId === 'null') {
            return res.status(400).json({
                success: false,
                message: "Tenant ID must be provided"
            });
        }

        if (!email) {
            return res.status(400).json({ success: false, message: "Email must be provided" });
        }

        const payload = {
            client_type,
            first_name,
            last_name,
            email: client_email,
            lead_source_id,
            lead_status_id
        };

        const result = await apiRequest(`${process.env.CORE_SERVICE_BASE_URL}/api/prospects`, 'post', payload, {}, process.env.CORE_API_KEY, tenantId);

        if (result.status === 200 || result.status === 201) {
            await ChatSession.destroy({ where: { tenantId } }); // Wipe draft context
            return res.status(200).json({
                success: true,
                message: result?.message || `Prospect has been created`
            });
        } else {
            return res.status(400).json({
                success: false,
                message: result?.message || `Failed to create prospect`
            });
        }
    } catch (error) {
        console.error("Error creating prospect:", error);
        return res.status(500).json({ success: false, message: "Failed to save permanent prospect record." });
    }
};

exports.getLeadSources = async (req, res) => {
    try {
        const tenantId = req.headers['x-tenant-id'] || req.query.tenantId;
        const { page, per_page, search, sort_by, sort_order, is_search = 0 } = req.query;

        if (!tenantId || tenantId === 'null') {
            return res.status(400).json({
                success: false,
                message: "Tenant ID must be provided"
            });
        }

        const params = new URLSearchParams({
            page: page || 1,
            per_page: per_page || 15,
            search: search || '',
            sort_by: sort_by || 'created_at',
            sort_order: sort_order || 'desc'
        });

        const result = await apiRequest(`${process.env.CORE_SERVICE_BASE_URL}/api/lead-sources?${params}`, 'get', null, {}, process.env.CORE_API_KEY, tenantId);

        if (result.status === 200) {
            const apiData = result.data.data || [];
            if (parseInt(is_search) === 1) {
                return res.status(200).json({
                    success: true,
                    lead_source_id: apiData[0]?.id,
                    message: 'Retrieved lead source ID successfully'
                });
            } else {
                const leadSources = apiData.map(item => ({ id: item.id, name: item.name }));
                return res.status(200).json({ success: true, data: leadSources, message: 'Retrieved lead sources' });
            }
        } else {
            return res.status(400).json({ success: false, message: result?.message || `Failed to retrieve lead sources` });
        }
    } catch (error) {
        console.error('Error in clientController.getLeadSources:', error);
        return res.status(500).json({ success: false, error: true, message: `Internal Server Error: ${error.message}` });
    }
};

exports.getLeadStatuses = async (req, res) => {
    try {
        const tenantId = req.headers['x-tenant-id'] || req.query.tenantId;
        const { page, per_page, search, sort_by, sort_order, is_search = 0 } = req.query;

        if (!tenantId || tenantId === 'null') {
            return res.status(400).json({
                success: false,
                message: "Tenant ID must be provided"
            });
        }

        const params = new URLSearchParams({
            page: page || 1,
            per_page: per_page || 15,
            search: search || '',
            sort_by: sort_by || 'created_at',
            sort_order: sort_order || 'desc'
        });

        const result = await apiRequest(`${process.env.CORE_SERVICE_BASE_URL}/api/lead-statuses?${params}`, 'get', null, {}, process.env.CORE_API_KEY, tenantId);

        if (result.status === 200) {
            const apiData = result.data.data || [];
            if (parseInt(is_search) === 1) {
                return res.status(200).json({
                    success: true,
                    lead_status_id: apiData[0]?.id,
                    message: 'Retrieved lead status ID successfully'
                });
            } else {
                const leadStatuses = apiData.map(item => ({ id: item.id, name: item.name }));
                return res.status(200).json({ success: true, data: leadStatuses, message: 'Retrieved lead statuses' });
            }
        } else {
            return res.status(400).json({ success: false, message: result?.message || `Failed to retrieve lead statuses` });
        }
    } catch (error) {
        console.error('Error in clientController.getLeadStatuses:', error);
        return res.status(500).json({ success: false, error: true, message: `Internal Server Error: ${error.message}` });
    }
};
