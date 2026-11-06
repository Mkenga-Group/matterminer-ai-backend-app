const Joi = require('joi');

/**
 * Generic Joi validation middleware factory.
 * Validates req.body against the provided schema while allowing unknown properties
 * so upstream AI Agent metadata fields are not rejected unexpectedly.
 */
const validateBody = (schema) => (req, res, next) => {
    const payloadToValidate = req.body && typeof req.body === 'object' ? req.body : {};
    const { error, value } = schema.validate(payloadToValidate, {
        abortEarly: false,
        allowUnknown: true,
        stripUnknown: false
    });

    if (error) {
        const errorMessages = error.details.map((detail) => detail.message);
        return res.status(400).json({
            success: false,
            message: errorMessages.join('; '),
            errors: errorMessages
        });
    }

    req.body = value;
    return next();
};

const contactDataSubSchema = Joi.object({
    first_name: Joi.string().trim().required(),
    middle_name: Joi.string().allow(null, '').optional(),
    last_name: Joi.string().trim().required(),
    title: Joi.string().allow(null, '').optional(),
    email: Joi.string().email().allow(null, '').optional(),
    primary_phone_number_country_code: Joi.alternatives().try(Joi.string(), Joi.number()).allow(null, '').optional(),
    primary_phone_number: Joi.string().allow(null, '').optional(),
    secondary_phone_number_country_code: Joi.alternatives().try(Joi.string(), Joi.number()).allow(null, '').optional(),
    secondary_phone_number: Joi.string().allow(null, '').optional(),
    model_type: Joi.string().allow(null, '').optional(),
    model_id: Joi.number().integer().allow(null).optional()
});

const schemas = {
    login: Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().required()
    }),

    calendarEvent: Joi.object({
        title: Joi.string().trim().required(),
        start_datetime: Joi.string().trim().min(8).required(),
        end_datetime: Joi.string().trim().min(8).required(),
        description: Joi.string().allow(null, '').optional(),
        colour_code: Joi.string().allow(null, '').optional(),
        location: Joi.string().allow(null, '').optional(),
        timezone: Joi.string().allow(null, '').optional(),
        is_all_day: Joi.boolean().optional(),
        sync_to_calendar: Joi.boolean().optional(),
        recurrence_rule: Joi.string().allow(null, '').optional(),
        matter_id: Joi.number().integer().allow(null).optional(),
        user_id: Joi.number().integer().allow(null).optional(),
        calendar_event_type_id: Joi.number().integer().allow(null).optional(),
        visibility: Joi.string().valid('public', 'private').optional(),
        status: Joi.string().optional(),
        event_type: Joi.string().optional(),
        attendees: Joi.array().items(Joi.any()).allow(null).optional(),
        reminders: Joi.array().items(
            Joi.object({
                method: Joi.string().required(),
                minutes: Joi.number().integer().min(0).required()
            })
        ).allow(null).optional()
    }),

    createContact: Joi.object({
        contact_type: Joi.string().optional(),
        entity: Joi.string().allow(null, '').optional(),
        entity_id: Joi.number().integer().allow(null).optional(),
        title: Joi.string().allow(null, '').optional(),
        first_name: Joi.string().trim().required(),
        middle_name: Joi.string().allow(null, '').optional(),
        last_name: Joi.string().trim().required(),
        email: Joi.string().email().allow(null, '').optional(),
        client_email: Joi.string().email().allow(null, '').optional(),
        country_code: Joi.alternatives().try(Joi.string(), Joi.number()).allow(null, '').optional(),
        phone_number: Joi.string().allow(null, '').optional(),
        model_type: Joi.string().allow(null, '').optional(),
        model_id: Joi.number().integer().allow(null).optional(),
        active: Joi.boolean().allow(null).optional(),
        featured: Joi.boolean().allow(null).optional(),
        include_in_emails: Joi.boolean().allow(null).optional()
    }),

    createClient: Joi.object({
        reference_number: Joi.string().allow(null, '').optional(),
        client_type: Joi.string().optional(),
        company_name: Joi.string().allow(null, '').optional(),
        client_number: Joi.string().allow(null, '').optional(),
        override_reason: Joi.string().allow(null, '').optional(),
        country_id: Joi.number().integer().required(),
        street: Joi.string().trim().required(),
        suite: Joi.string().allow(null, '').optional(),
        town: Joi.string().allow(null, '').optional(),
        state: Joi.string().allow(null, '').optional(),
        zip_code: Joi.string().allow(null, '').optional(),
        contact_id: Joi.alternatives().try(Joi.number().integer(), Joi.string()).allow(null, '').optional(),
        relationship_manager_id: Joi.number().integer().allow(null).optional(),
        account_trusted: Joi.boolean().allow(null).optional(),
        acquisition_channel: Joi.string().allow(null, '').optional(),
        notes: Joi.string().allow(null, '').optional(),
        contact_data: contactDataSubSchema.allow(null).optional(),
        first_name: Joi.when('contact_data', {
            is: Joi.object().required(),
            then: Joi.string().allow(null, '').optional(),
            otherwise: Joi.when('contact_id', {
                is: Joi.alternatives().try(Joi.number().integer(), Joi.string().min(1)).required(),
                then: Joi.string().allow(null, '').optional(),
                otherwise: Joi.string().trim().required()
            })
        }),
        last_name: Joi.when('contact_data', {
            is: Joi.object().required(),
            then: Joi.string().allow(null, '').optional(),
            otherwise: Joi.when('contact_id', {
                is: Joi.alternatives().try(Joi.number().integer(), Joi.string().min(1)).required(),
                then: Joi.string().allow(null, '').optional(),
                otherwise: Joi.string().trim().required()
            })
        }),
        client_email: Joi.string().email().allow(null, '').optional(),
        email: Joi.string().email().allow(null, '').optional(),
        form_input_values: Joi.array().items(Joi.any()).optional(),
        tax_registrations: Joi.array().items(
            Joi.object({
                name: Joi.string().required(),
                number: Joi.string().required(),
                include_on_invoice: Joi.boolean().allow(null).optional()
            })
        ).optional()
    }),

    createMatter: Joi.object({
        reference_number: Joi.string().allow(null, '').optional(),
        client_id: Joi.number().integer().required(),
        title: Joi.string().trim().allow(null, '').optional(),
        name: Joi.when('title', {
            is: Joi.string().trim().min(1).required(),
            then: Joi.string().trim().allow(null, '').optional(),
            otherwise: Joi.string().trim().required()
        }),
        matter_number: Joi.string().allow(null, '').optional(),
        override_reason: Joi.string().allow(null, '').optional(),
        practice_area_id: Joi.number().integer().required(),
        case_stage_id: Joi.number().integer().required(),
        billing_type_id: Joi.number().integer().required(),
        access_type: Joi.string().optional(),
        status: Joi.string().optional(),
        lawyer_assignments: Joi.array().items(
            Joi.alternatives().try(
                Joi.object({
                    user_id: Joi.number().integer().required(),
                    is_primary: Joi.boolean().optional(),
                    hourly_rate: Joi.number().allow(null).optional(),
                    rate_currency: Joi.string().allow(null, '').optional()
                }),
                Joi.number().integer()
            )
        ).optional(),
        limitation_statutes: Joi.array().items(
            Joi.object({
                name: Joi.string().required(),
                description: Joi.string().allow(null, '').optional(),
                due_at: Joi.string().allow(null, '').optional()
            })
        ).optional(),
        billing_type_details: Joi.array().items(Joi.object()).optional(),
        billing_types: Joi.array().items(Joi.object()).optional(),
        access_types: Joi.array().items(Joi.object()).optional(),
        matter_users: Joi.array().items(Joi.number().integer()).optional(),
        matter_groups: Joi.array().items(Joi.number().integer()).optional(),
        form_input_types: Joi.array().items(Joi.any()).optional(),
        form_input_values: Joi.array().items(Joi.any()).optional(),
        matter_budget: Joi.object({
            amount: Joi.number().allow(null).optional(),
            currency: Joi.string().allow(null, '').optional(),
            budget_currency: Joi.string().allow(null, '').optional(),
            default_currency: Joi.string().allow(null, '').optional(),
            rate: Joi.number().allow(null).optional()
        }).allow(null).optional()
    }),

    createProspect: Joi.object({
        lead_number: Joi.string().allow(null, '').optional(),
        client_type: Joi.string().optional(),
        company_name: Joi.string().allow(null, '').optional(),
        country_id: Joi.number().integer().allow(null).optional(),
        street: Joi.string().allow(null, '').optional(),
        suite: Joi.string().allow(null, '').optional(),
        town: Joi.string().allow(null, '').optional(),
        state: Joi.string().allow(null, '').optional(),
        zip_code: Joi.string().allow(null, '').optional(),
        contact_id: Joi.alternatives().try(Joi.number().integer(), Joi.string()).allow(null, '').optional(),
        lead_source_id: Joi.number().integer().required(),
        lead_status_id: Joi.number().integer().required(),
        communication_channel_id: Joi.number().integer().allow(null).optional(),
        date_contacted: Joi.string().allow(null, '').optional(),
        assigned_user: Joi.number().integer().allow(null).optional(),
        notes: Joi.string().allow(null, '').optional(),
        approver_id: Joi.number().integer().allow(null).optional(),
        contact_data: contactDataSubSchema.allow(null).optional(),
        first_name: Joi.when('contact_data', {
            is: Joi.object().required(),
            then: Joi.string().allow(null, '').optional(),
            otherwise: Joi.when('contact_id', {
                is: Joi.alternatives().try(Joi.number().integer(), Joi.string().min(1)).required(),
                then: Joi.string().allow(null, '').optional(),
                otherwise: Joi.string().trim().required()
            })
        }),
        last_name: Joi.when('contact_data', {
            is: Joi.object().required(),
            then: Joi.string().allow(null, '').optional(),
            otherwise: Joi.when('contact_id', {
                is: Joi.alternatives().try(Joi.number().integer(), Joi.string().min(1)).required(),
                then: Joi.string().allow(null, '').optional(),
                otherwise: Joi.string().trim().required()
            })
        }),
        client_email: Joi.string().email().allow(null, '').optional(),
        email: Joi.string().email().allow(null, '').optional()
    }),

    createTask: Joi.object({
        name: Joi.string().trim().required(),
        description: Joi.string().allow(null, '').optional(),
        is_matter_related: Joi.alternatives().try(
            Joi.boolean(),
            Joi.string().valid('Yes', 'No', 'yes', 'no', 'true', 'false')
        ).allow(null).optional(),
        priority_id: Joi.number().integer().required(),
        task_category_id: Joi.number().integer().required(),
        task_owner: Joi.number().integer().allow(null).optional(),
        client_id: Joi.number().integer().allow(null).optional(),
        matter_id: Joi.number().integer().allow(null).optional(),
        status_tracks: Joi.array().items(Joi.object()).allow(null).optional(),
        assignees: Joi.array().items(Joi.any()).allow(null).optional(),
        observer_ids: Joi.array().items(Joi.number().integer()).allow(null).optional(),
        subtasks: Joi.array().items(Joi.object()).allow(null).optional()
    })
};

module.exports = {
    validateLogin: validateBody(schemas.login),
    validateCalendarEvent: validateBody(schemas.calendarEvent),
    validateCreateContact: validateBody(schemas.createContact),
    validateCreateClient: validateBody(schemas.createClient),
    validateCreateMatter: validateBody(schemas.createMatter),
    validateCreateProspect: validateBody(schemas.createProspect),
    validateCreateTask: validateBody(schemas.createTask),
    schemas
};

