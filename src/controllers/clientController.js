const { Client, ChatSession } = require('../models');

const { apiRequest } = require('../utils/apiHelper');

const { storeCoreLogin, getCoreLogin } = require('../services/redisService');

//const CORE_SERVICE_BASE_URL = 'https://dev.matterminer.com/api/login';

const API_VERSION_PREFIX = '/api/v1';

/**
 * Helper to construct versioned Core API URLs (/api/v1/...)
 * Safely strips any trailing slash from BASE_URL to prevent double-slash paths.
 */
const getCoreApiUrl = (endpoint) => {
    const baseUrl = (process.env.BASE_URL || '').replace(/\/+$/, '');
    return `${baseUrl}${API_VERSION_PREFIX}${endpoint}`;
};

/**
 * Reusable lookup helper (DRY principle) for paginated Core API list/search endpoints
 */
const fetchLookupResource = async (req, res, { endpoint, idFieldKey, searchSuccessMessage, listSuccessMessage, errorMessage, logTag }) => {
    try {
        const tenantId = req.headers?.['x-tenant-id'] || req.query?.tenantId || req.body?.tenantId;
        const { page, per_page, search, sort_by, sort_order, is_search = 0 } = req.query || {};

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

        const result = await apiRequest(getCoreApiUrl(`${endpoint}?${params}`), 'get', null, {}, process.env.CORE_API_KEY, tenantId);
        if (result.status === 200) {
            const apiData = result.data?.data || [];
            const items = apiData.map(item => ({
                id: item.id,
                name: item.name || item.company_name || [item.first_name, item.last_name].filter(Boolean).join(' ') || item.title || null
            }));
            if (parseInt(is_search, 10) === 1) {
                return res.status(200).json({
                    success: true,
                    [idFieldKey]: apiData[0]?.id ?? null,
                    data: items,
                    message: searchSuccessMessage
                });
            } else {
                return res.status(200).json({
                    success: true,
                    data: items,
                    message: listSuccessMessage
                });
            }
        } else {
            const statusCode = (result?.status === 401 || result?.status === 403) ? result.status : 400;
            return res.status(statusCode).json({
                success: false,
                message: result?.message || errorMessage
            });
        }
    } catch (error) {
        // 4. Global Catch for unexpected server errors
        console.error(`Error in clientController.${logTag}:`, error);
        return res.status(500).json({
            success: false,
            error: true,
            message: `Internal Server Error: ${error.message}`
        });
    }
};

exports.createEvent = async (req, res) => {
    const {
        title,
        start_datetime,
        end_datetime,
        description,
        colour_code = null,
        location = null,
        timezone = null,
        sync_to_calendar = false,
        recurrence_rule = null,
        matter_id = null,
        user_id = null,
        calendar_event_type_id = null,
        visibility = "private",
        status = "confirmed",
        event_type = "hearing",
        attendees = null,
        reminders
    } = req.body || {};
    const email = req.headers?.['x-user-email'];
    const tenantId = req.headers?.['x-tenant-id'] || req.body?.tenantId || req.query?.tenantId;

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
            description: description ? `${description} \npowered by Nuru` : null,
            colour_code,
            location,
            timezone,
            is_all_day: false,
            sync_to_calendar,
            recurrence_rule,
            matter_id,
            user_id,
            calendar_event_type_id,
            visibility,
            status,
            event_type,
            attendees,
            reminders: reminders ?? [
                {
                    method: "email",
                    minutes: 60
                },
                {
                    method: "popup",
                    minutes: 15
                }
            ]
        };

        const result = await apiRequest(getCoreApiUrl('/calendar'), 'post', payload, {}, process.env.CORE_API_KEY, tenantId);

        if (result.status === 200 || result.status === 201) {
            //-. Cleanup chat session
            await ChatSession.destroy({ where: { tenantId } });
            return res.status(200).json({
                success: true,
                data: result?.data?.data ?? result?.data ?? null,
                message: result?.message || `Event has been created`
            });
        } else {
            const statusCode = (result?.status === 401 || result?.status === 403) ? result.status : 400;
            return res.status(statusCode).json({
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
    const {
        title,
        start_datetime,
        end_datetime,
        description,
        colour_code = null,
        location = null,
        timezone = null,
        sync_to_calendar = false,
        recurrence_rule = null,
        matter_id = null,
        user_id = null,
        calendar_event_type_id = null,
        visibility = "private",
        status = "confirmed",
        event_type = "hearing",
        attendees = null,
        reminders
    } = req.body || {};
    const email = req.headers?.['x-user-email'];
    const tenantId = req.headers?.['x-tenant-id'] || req.body?.tenantId || req.query?.tenantId;

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
            description: description ? `${description} \npowered by Nuru` : null,
            colour_code,
            location,
            timezone,
            is_all_day: true,
            sync_to_calendar,
            recurrence_rule,
            matter_id,
            user_id,
            calendar_event_type_id,
            visibility,
            status,
            event_type,
            attendees,
            reminders: reminders ?? [
                {
                    method: "email",
                    minutes: 1440
                }
            ]
        };

        const result = await apiRequest(getCoreApiUrl('/calendar'), 'post', payload, {}, process.env.CORE_API_KEY, tenantId);

        if (result.status === 200 || result.status === 201) {
            //-. Cleanup chat session
            await ChatSession.destroy({ where: { tenantId } });
            return res.status(200).json({
                success: true,
                data: result?.data?.data ?? result?.data ?? null,
                message: result?.message || `Event has been created`
            });
        } else {
            const statusCode = (result?.status === 401 || result?.status === 403) ? result.status : 400;
            return res.status(statusCode).json({
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
    const {
        contact_type = "primary",
        entity = null,
        entity_id = null,
        title = null,
        first_name,
        middle_name = null,
        last_name,
        client_email,
        email: bodyEmail,
        country_code = null,
        phone_number = null,
        model_type = "App\\Models\\Prospect",
        model_id = 1,
        active = true,
        featured = false,
        include_in_emails = null
    } = req.body || {};
    const email = req.headers?.['x-user-email'];
    const tenantId = req.headers?.['x-tenant-id'] || req.body?.tenantId || req.query?.tenantId;

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
            entity,
            entity_id,
            title,
            first_name,
            middle_name,
            last_name,
            email: client_email ?? bodyEmail ?? null,
            country_code: country_code !== null && country_code !== undefined ? `${country_code}` : null,
            phone_number,
            model_type,
            model_id,
            active,
            featured,
            include_in_emails
        };

        const result = await apiRequest(getCoreApiUrl('/contacts'), 'post', payload, {}, process.env.CORE_API_KEY, tenantId);

        if (result.status === 200 || result.status === 201) {
            //-. Cleanup chat session
            await ChatSession.destroy({ where: { tenantId } });
            return res.status(200).json({
                success: true,
                data: result?.data?.data ?? result?.data ?? null,
                message: result?.message || `Contact has been created`
            });
        } else {
            const statusCode = (result?.status === 401 || result?.status === 403) ? result.status : 400;
            return res.status(statusCode).json({
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
    const {
        reference_number = null,
        client_type = "company",
        company_name = null,
        client_number = null,
        override_reason = null,
        country_id,
        street,
        suite = null,
        town = null,
        state = null,
        zip_code = null,
        contact_id = null,
        relationship_manager_id = null,
        account_trusted = null,
        acquisition_channel = null,
        notes = null,
        contact_data,
        form_input_values = [],
        tax_registrations = [],
        // Flat fallback attributes for backward compatibility with AI agent payloads
        first_name,
        middle_name = null,
        last_name,
        title = null,
        client_email,
        email: bodyEmail,
        primary_phone_number_country_code = null,
        primary_phone_number = null,
        secondary_phone_number_country_code = null,
        secondary_phone_number = null,
        model_type = null,
        model_id = null
    } = req.body || {};
    const email = req.headers?.['x-user-email'];
    const tenantId = req.headers?.['x-tenant-id'] || req.body?.tenantId || req.query?.tenantId;

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

        // 1. Create a log record aligned with POST /api/v1/clients schema
        const hasFlatContactFields = Boolean(first_name || last_name || client_email || bodyEmail);
        const resolvedContactData = contact_data || (!contact_id && hasFlatContactFields ? {
            first_name: first_name ?? null,
            middle_name: middle_name ?? null,
            last_name: last_name ?? null,
            title: title ?? null,
            email: client_email ?? bodyEmail ?? null,
            primary_phone_number_country_code,
            primary_phone_number,
            secondary_phone_number_country_code,
            secondary_phone_number,
            model_type,
            model_id
        } : null);

        const payload = {
            reference_number,
            client_type,
            company_name,
            client_number,
            override_reason,
            country_id,
            street,
            suite,
            town,
            state,
            zip_code,
            contact_id,
            relationship_manager_id,
            account_trusted,
            acquisition_channel,
            notes,
            contact_data: resolvedContactData,
            form_input_values,
            tax_registrations
        };

        const result = await apiRequest(getCoreApiUrl('/clients'), 'post', payload, {}, process.env.CORE_API_KEY, tenantId);

        if (result.status === 200 || result.status === 201) {
            //-. Cleanup chat session
            await ChatSession.destroy({ where: { tenantId } });
            return res.status(200).json({
                success: true,
                data: result?.data?.data ?? result?.data ?? null,
                message: result?.message || `Client has been created`
            });
        } else {
            const statusCode = (result?.status === 401 || result?.status === 403) ? result.status : 400;
            return res.status(statusCode).json({
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
    const {
        reference_number = null,
        client_id,
        name,
        matter_number = null,
        override_reason = null,
        practice_area_id,
        case_stage_id,
        billing_type_id,
        access_type = "public",
        status = "open",
        lawyer_assignments = [],
        limitation_statutes = [],
        billing_type_details = [],
        billing_types = [],
        access_types = [],
        matter_users = [],
        matter_groups = [],
        form_input_types = [],
        form_input_values = [],
        matter_budget = null
    } = req.body || {};
    const email = req.headers?.['x-user-email'];
    const tenantId = req.headers?.['x-tenant-id'] || req.body?.tenantId || req.query?.tenantId;

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

        // 1. Create a log record aligned with POST /api/v1/matters schema
        const normalizedLawyers = Array.isArray(lawyer_assignments)
            ? lawyer_assignments.map((item, idx) => (
                typeof item === 'number' || typeof item === 'string'
                    ? { user_id: Number(item), is_primary: idx === 0, hourly_rate: null, rate_currency: null }
                    : item
            ))
            : [];

        const payload = {
            reference_number,
            client_id,
            name: name || req.body?.title,
            matter_number,
            override_reason,
            practice_area_id,
            case_stage_id,
            billing_type_id,
            access_type,
            status,
            lawyer_assignments: normalizedLawyers,
            limitation_statutes,
            billing_type_details,
            billing_types,
            access_types,
            matter_users,
            matter_groups,
            form_input_types,
            form_input_values,
            matter_budget
        };

        const result = await apiRequest(getCoreApiUrl('/matters'), 'post', payload, {}, process.env.CORE_API_KEY, tenantId);

        if (result.status === 200 || result.status === 201) {
            //-. Cleanup chat session
            await ChatSession.destroy({ where: { tenantId } });
            return res.status(200).json({
                success: true,
                data: result?.data?.data ?? result?.data ?? null,
                message: result?.message || `Matter has been created`
            });
        } else {
            const statusCode = (result?.status === 401 || result?.status === 403) ? result.status : 400;
            return res.status(statusCode).json({
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
    const { email, password } = req.body || {};

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

        const result = await apiRequest(getCoreApiUrl('/login'), 'post', payload);

        if (result.status === 200) {
            const _message = result.data?.message || result.message;
            const _access_token =
                result.data?.data?.access_token ||
                result.data?.access_token ||
                result.data?.token?.access_token;
            if (!_access_token) {
                return res.status(401).json({
                    success: false,
                    access_token: null,
                    message: _message || "Authentication failed: No access token returned"
                });
            }
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
    const email = req.headers?.['x-user-email'] || req.query?.email;
    const tenantId = req.headers?.['x-tenant-id'] || req.query?.tenantId || req.body?.tenantId;
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
        const email = req.headers?.['x-user-email'];
        const tenantId = req.headers?.['x-tenant-id'] || req.query?.tenantId || req.body?.tenantId;
        const { page, per_page, search, sort_by, sort_order } = req.query || {};

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

        const result = await apiRequest(getCoreApiUrl(`/countries?${params}`), 'get', null, {}, process.env.CORE_API_KEY, tenantId);
        if (result.status === 200) {
            const apiData = result.data?.data || [];
            const countryId = apiData[0]?.id ?? null;
            if (!countryId) {
                return res.status(404).json({
                    success: false,
                    country_id: null,
                    data: [],
                    message: 'Country Id not found'
                });
            }
            return res.status(200).json({
                success: true,
                country_id: countryId,
                data: apiData.map(item => ({ id: item.id, name: item.name })),
                message: 'Retreived country id successfully'
            });
        } else {
            const statusCode = (result?.status === 401 || result?.status === 403) ? result.status : 400;
            return res.status(statusCode).json({
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
        const email = req.headers?.['x-user-email'];
        const tenantId = req.headers?.['x-tenant-id'] || req.query?.tenantId || req.body?.tenantId;
        const { page, per_page, search, sort_by, sort_order } = req.query || {};

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

        const urlParams = getCoreApiUrl(`/contacts?${params}`);

        const result = await apiRequest(urlParams, 'get', null, {}, process.env.CORE_API_KEY, tenantId);
        if (result.status === 200) {
            const _id = result.data?.data?.[0]?.id ?? null;
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
            const statusCode = (result?.status === 401 || result?.status === 403) ? result.status : 400;
            return res.status(statusCode).json({
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
    return fetchLookupResource(req, res, {
        endpoint: '/case-stages',
        idFieldKey: 'case_stage_id',
        searchSuccessMessage: 'Retreive case stage id successfully',
        listSuccessMessage: 'Retreived case stage or practise area',
        errorMessage: 'Failed get the country id',
        logTag: 'getCaseStageInfo'
    });
};

exports.getPracticeAreaInfo = async (req, res) => {
    return fetchLookupResource(req, res, {
        endpoint: '/practice-areas',
        idFieldKey: 'practice_area_id',
        searchSuccessMessage: 'Retreive case stage id successfully',
        listSuccessMessage: 'Retreived practise area',
        errorMessage: 'Failed get the country id',
        logTag: 'getPracticeAreaInfo'
    });
};

exports.getBillingInfo = async (req, res) => {
    return fetchLookupResource(req, res, {
        endpoint: '/billing-types',
        idFieldKey: 'billing_type_id',
        searchSuccessMessage: 'Retreived billing_type_id successfully',
        listSuccessMessage: 'Billing types retrieved successfully',
        errorMessage: 'Failed to retrieve billing info',
        logTag: 'getBillingInfo'
    });
};

exports.createProspect = async (req, res) => {
    // Note: AI Agent maps email to client_email
    const {
        lead_number = null,
        client_type = "company",
        company_name = null,
        country_id = null,
        street = null,
        suite = null,
        town = null,
        state = null,
        zip_code = null,
        contact_id = null,
        lead_source_id,
        lead_status_id,
        communication_channel_id = null,
        date_contacted = null,
        assigned_user = null,
        notes = null,
        approver_id = null,
        contact_data,
        // Flat fallback attributes for backward compatibility with AI agent payloads
        first_name,
        middle_name = null,
        last_name,
        title = null,
        client_email,
        email: bodyEmail,
        primary_phone_number_country_code = null,
        primary_phone_number = null,
        secondary_phone_number_country_code = null,
        secondary_phone_number = null,
        model_type = null,
        model_id = null
    } = req.body || {};
    const email = req.headers?.['x-user-email'];
    const tenantId = req.headers?.['x-tenant-id'] || req.body?.tenantId || req.query?.tenantId;

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

        const hasFlatContactFields = Boolean(first_name || last_name || client_email || bodyEmail);
        const resolvedContactData = contact_data || (!contact_id && hasFlatContactFields ? {
            first_name: first_name ?? null,
            middle_name: middle_name ?? null,
            last_name: last_name ?? null,
            title: title ?? null,
            email: client_email ?? bodyEmail ?? null,
            primary_phone_number_country_code,
            primary_phone_number,
            secondary_phone_number_country_code,
            secondary_phone_number,
            model_type,
            model_id
        } : null);

        const payload = {
            lead_number,
            client_type,
            company_name,
            country_id,
            street,
            suite,
            town,
            state,
            zip_code,
            contact_id,
            lead_source_id,
            lead_status_id,
            communication_channel_id,
            date_contacted,
            assigned_user,
            notes,
            approver_id,
            contact_data: resolvedContactData
        };

        const result = await apiRequest(getCoreApiUrl('/prospects'), 'post', payload, {}, process.env.CORE_API_KEY, tenantId);

        if (result.status === 200 || result.status === 201) {
            await ChatSession.destroy({ where: { tenantId } }); // Wipe draft context
            return res.status(200).json({
                success: true,
                data: result?.data?.data ?? result?.data ?? null,
                message: result?.message || `Prospect has been created`
            });
        } else {
            const statusCode = (result?.status === 401 || result?.status === 403) ? result.status : 400;
            return res.status(statusCode).json({
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
    return fetchLookupResource(req, res, {
        endpoint: '/lead-sources',
        idFieldKey: 'lead_source_id',
        searchSuccessMessage: 'Retrieved lead source ID successfully',
        listSuccessMessage: 'Retrieved lead sources',
        errorMessage: 'Failed to retrieve lead sources',
        logTag: 'getLeadSources'
    });
};

exports.getLeadStatuses = async (req, res) => {
    return fetchLookupResource(req, res, {
        endpoint: '/lead-statuses',
        idFieldKey: 'lead_status_id',
        searchSuccessMessage: 'Retrieved lead status ID successfully',
        listSuccessMessage: 'Retrieved lead statuses',
        errorMessage: 'Failed to retrieve lead statuses',
        logTag: 'getLeadStatuses'
    });
};

exports.getClients = async (req, res) => {
    return fetchLookupResource(req, res, {
        endpoint: '/clients',
        idFieldKey: 'client_id',
        searchSuccessMessage: 'Retrieved client ID successfully',
        listSuccessMessage: 'Retrieved clients',
        errorMessage: 'Failed to retrieve clients',
        logTag: 'getClients'
    });
};

exports.getMatterInfo = async (req, res) => {
    return fetchLookupResource(req, res, {
        endpoint: '/matters',
        idFieldKey: 'matter_id',
        searchSuccessMessage: 'Retrieved matter ID successfully',
        listSuccessMessage: 'Retrieved matters',
        errorMessage: 'Failed to retrieve matters',
        logTag: 'getMatterInfo'
    });
};

exports.getTaskCategories = async (req, res) => {
    return fetchLookupResource(req, res, {
        endpoint: '/task-categories',
        idFieldKey: 'task_category_id',
        searchSuccessMessage: 'Retrieved task category ID successfully',
        listSuccessMessage: 'Retrieved task categories',
        errorMessage: 'Failed to retrieve task categories',
        logTag: 'getTaskCategories'
    });
};

exports.getTaskPriorities = async (req, res) => {
    return fetchLookupResource(req, res, {
        endpoint: '/task-priority-levels',
        idFieldKey: 'priority_id',
        searchSuccessMessage: 'Retrieved task priority ID successfully',
        listSuccessMessage: 'Retrieved task priorities',
        errorMessage: 'Failed to retrieve task priorities',
        logTag: 'getTaskPriorities'
    });
};

exports.getTaskStatuses = async (req, res) => {
    return fetchLookupResource(req, res, {
        endpoint: '/task-status-levels',
        idFieldKey: 'task_status_id',
        searchSuccessMessage: 'Retrieved task status ID successfully',
        listSuccessMessage: 'Retrieved task statuses',
        errorMessage: 'Failed to retrieve task statuses',
        logTag: 'getTaskStatuses'
    });
};

exports.createTask = async (req, res) => {
    const {
        name,
        description = null,
        is_matter_related = false,
        priority_id,
        task_category_id,
        task_owner = null,
        client_id = null,
        matter_id = null,
        status_tracks = [],
        assignees = [],
        observer_ids = null,
        subtasks = []
    } = req.body || {};
    const email = req.headers?.['x-user-email'];
    const tenantId = req.headers?.['x-tenant-id'] || req.body?.tenantId || req.query?.tenantId;

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

        const resolvedMatterRelated = typeof is_matter_related === 'string'
            ? is_matter_related.toLowerCase() === 'yes' || is_matter_related.toLowerCase() === 'true'
            : Boolean(is_matter_related);

        const payload = {
            name,
            description,
            is_matter_related: resolvedMatterRelated,
            priority_id,
            task_category_id,
            task_owner,
            client_id: resolvedMatterRelated ? client_id : null,
            matter_id: resolvedMatterRelated ? matter_id : null,
            status_tracks,
            assignees,
            observer_ids,
            subtasks
        };

        const result = await apiRequest(getCoreApiUrl('/tasks'), 'post', payload, {}, process.env.CORE_API_KEY, tenantId);

        if (result.status === 200 || result.status === 201) {
            await ChatSession.destroy({ where: { tenantId } });
            return res.status(200).json({
                success: true,
                data: result?.data?.data ?? result?.data ?? null,
                message: result?.message || `Task has been created`
            });
        } else {
            const statusCode = (result?.status === 401 || result?.status === 403) ? result.status : 400;
            return res.status(statusCode).json({
                success: false,
                message: result?.message || `Failed to create task`
            });
        }
    } catch (error) {
        console.error("Error creating task:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to save permanent task record."
        });
    }
};
