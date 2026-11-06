const assert = require('assert');
const http = require('http');
const path = require('path');
const express = require('express');

process.env.BASE_URL = 'https://api.matterminer.com';
process.env.CORE_API_KEY = 'smoke_test_api_key';

// Track upstream requests & DB cleanup
const upstreamRequests = [];
const destroyedSessions = [];
const redisCache = {};
let mockUpstreamHandler = null;

// 1. Mock ../models
const modelsPath = path.resolve(__dirname, '../models', 'index.js');
require.cache[modelsPath] = {
    id: modelsPath,
    filename: modelsPath,
    loaded: true,
    exports: {
        Client: {},
        ChatSession: {
            destroy: async ({ where }) => {
                destroyedSessions.push(where.tenantId);
            }
        }
    }
};

// 2. Mock ../utils/apiHelper
const apiHelperPath = path.resolve(__dirname, '../utils', 'apiHelper.js');
require.cache[apiHelperPath] = {
    id: apiHelperPath,
    filename: apiHelperPath,
    loaded: true,
    exports: {
        apiRequest: async (url, method, data, customHeaders, apiKey, tenantId) => {
            const call = { url, method, data, customHeaders, apiKey, tenantId };
            upstreamRequests.push(call);
            if (mockUpstreamHandler) {
                return mockUpstreamHandler(call);
            }
            return { status: 200, message: 'OK', data: { data: [{ id: 1, name: 'Default' }] } };
        }
    }
};

// 3. Mock ../services/redisService
const redisServicePath = path.resolve(__dirname, '../services', 'redisService.js');
require.cache[redisServicePath] = {
    id: redisServicePath,
    filename: redisServicePath,
    loaded: true,
    exports: {
        storeCoreLogin: async (email, tokenObj) => {
            redisCache[email] = tokenObj;
        },
        getCoreLogin: async (email) => {
            return redisCache[email] || null;
        }
    }
};

const clientRoutes = require('../routes/clientRoutes');

async function sendRequest(baseUrl, method, routePath, { headers = {}, body = null } = {}) {
    const res = await fetch(`${baseUrl}${routePath}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...headers
        },
        body: body ? JSON.stringify(body) : undefined
    });
    const json = await res.json();
    return { status: res.status, body: json };
}

async function runSmokeTests() {
    console.log('=== STARTING END-TO-END HTTP SMOKE TESTS FOR /app/v1/core ===');

    const app = express();
    app.use(express.json());
    app.use('/app/v1/core', clientRoutes);

    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}/app/v1/core`;

    const authHeaders = {
        'x-tenant-id': 'tenant_smoke_01',
        'x-user-email': 'architect@matterminer.com'
    };

    try {
        // 1. POST /login (Valid & Invalid)
        console.log('[Smoke 1] POST /login (validation failure + success)');
        let resp = await sendRequest(baseUrl, 'POST', '/login', {
            body: { email: 'not-an-email' }
        });
        assert.strictEqual(resp.status, 400, 'Expected 400 on invalid login payload');

        mockUpstreamHandler = () => ({
            status: 200,
            data: { message: 'Authenticated', data: { access_token: 'smoke_jwt_token_123' } }
        });
        resp = await sendRequest(baseUrl, 'POST', '/login', {
            body: { email: 'architect@matterminer.com', password: 'SecurePass@123' }
        });
        assert.strictEqual(resp.status, 200);
        assert.strictEqual(resp.body.access_token, 'smoke_jwt_token_123');
        assert.strictEqual(upstreamRequests[upstreamRequests.length - 1].url, 'https://api.matterminer.com/api/v1/login');

        // 2. GET /hasValidToken
        console.log('[Smoke 2] GET /hasValidToken');
        resp = await sendRequest(baseUrl, 'GET', '/hasValidToken', { headers: authHeaders });
        assert.strictEqual(resp.status, 200);
        assert.strictEqual(resp.body.access_token, 'smoke_jwt_token_123');

        // 3. POST /standard-event
        console.log('[Smoke 3] POST /standard-event');
        mockUpstreamHandler = () => ({ status: 201, message: 'Calendar event created' });
        resp = await sendRequest(baseUrl, 'POST', '/standard-event', {
            headers: authHeaders,
            body: {
                title: 'Client Strategy Call',
                start_datetime: '2026-11-15T09:00:00Z',
                end_datetime: '2026-11-15T10:00:00Z',
                description: 'Review contract terms',
                colour_code: '#FF5733',
                location: 'Zoom',
                timezone: 'UTC',
                sync_to_calendar: true,
                matter_id: 12,
                user_id: 5,
                calendar_event_type_id: 2,
                visibility: 'public',
                status: 'confirmed',
                event_type: 'hearing',
                attendees: [{ email: 'client@example.com' }]
            }
        });
        assert.strictEqual(resp.status, 200);
        let lastUpstream = upstreamRequests[upstreamRequests.length - 1];
        assert.strictEqual(lastUpstream.url, 'https://api.matterminer.com/api/v1/calendar');
        assert.strictEqual(lastUpstream.data.is_all_day, false);
        assert.strictEqual(lastUpstream.data.colour_code, '#FF5733');
        assert.strictEqual(lastUpstream.data.sync_to_calendar, true);
        assert.strictEqual(lastUpstream.data.matter_id, 12);

        // 4. POST /all-event
        console.log('[Smoke 4] POST /all-event');
        resp = await sendRequest(baseUrl, 'POST', '/all-event', {
            headers: authHeaders,
            body: {
                title: 'Annual Filing Deadline',
                start_datetime: '2026-11-20T00:00:00Z',
                end_datetime: '2026-11-20T23:59:59Z',
                description: 'Court filing'
            }
        });
        assert.strictEqual(resp.status, 200);
        lastUpstream = upstreamRequests[upstreamRequests.length - 1];
        assert.strictEqual(lastUpstream.url, 'https://api.matterminer.com/api/v1/calendar');
        assert.strictEqual(lastUpstream.data.is_all_day, true);
        assert.strictEqual(lastUpstream.data.reminders[0].minutes, 1440);

        // 5. POST /contact (with defaults + custom model_type/model_id)
        console.log('[Smoke 5] POST /contact');
        resp = await sendRequest(baseUrl, 'POST', '/contact', {
            headers: authHeaders,
            body: {
                first_name: 'Jane',
                last_name: 'Doe',
                email: 'jane.doe@example.com',
                country_code: 254,
                phone_number: '700111222'
            }
        });
        assert.strictEqual(resp.status, 200);
        lastUpstream = upstreamRequests[upstreamRequests.length - 1];
        assert.strictEqual(lastUpstream.url, 'https://api.matterminer.com/api/v1/contacts');
        assert.strictEqual(lastUpstream.data.model_type, 'App\\Models\\Prospect');
        assert.strictEqual(lastUpstream.data.model_id, 1);
        assert.strictEqual(lastUpstream.data.country_code, '254');

        // 6. POST /client (both Postman nested contact_data and flat AI payload)
        console.log('[Smoke 6] POST /client (Postman nested contact_data & flat fallback)');
        resp = await sendRequest(baseUrl, 'POST', '/client', {
            headers: authHeaders,
            body: {
                client_type: 'company',
                company_name: 'Global Tech Ltd',
                country_id: 1,
                street: '456 Enterprise Way',
                contact_data: {
                    first_name: 'John',
                    last_name: 'Smith',
                    email: 'john@globaltech.com'
                },
                tax_registrations: [
                    { name: 'VAT', number: 'VAT-001', include_on_invoice: true }
                ]
            }
        });
        assert.strictEqual(resp.status, 200);
        lastUpstream = upstreamRequests[upstreamRequests.length - 1];
        assert.strictEqual(lastUpstream.url, 'https://api.matterminer.com/api/v1/clients');
        assert.strictEqual(lastUpstream.data.contact_data.first_name, 'John');
        assert.strictEqual(lastUpstream.data.tax_registrations.length, 1);

        // 7. POST /matter & POST /matters
        console.log('[Smoke 7] POST /matter & POST /matters');
        resp = await sendRequest(baseUrl, 'POST', '/matters', {
            headers: authHeaders,
            body: {
                client_id: 5,
                name: 'IP Infringement Dispute',
                practice_area_id: 3,
                case_stage_id: 2,
                billing_type_id: 1,
                lawyer_assignments: [{ user_id: 9, is_primary: true, hourly_rate: 250, rate_currency: 'USD' }],
                matter_budget: { amount: 15000, currency: 'USD' }
            }
        });
        assert.strictEqual(resp.status, 200);
        lastUpstream = upstreamRequests[upstreamRequests.length - 1];
        assert.strictEqual(lastUpstream.url, 'https://api.matterminer.com/api/v1/matters');
        assert.strictEqual(lastUpstream.data.client_id, 5);
        assert.strictEqual(lastUpstream.data.lawyer_assignments[0].user_id, 9);

        // 8. POST /prospects
        console.log('[Smoke 8] POST /prospects');
        resp = await sendRequest(baseUrl, 'POST', '/prospects', {
            headers: authHeaders,
            body: {
                client_type: 'company',
                lead_source_id: 2,
                lead_status_id: 1,
                date_contacted: '2026-11-06T12:00:00Z',
                contact_data: {
                    first_name: 'Sarah',
                    last_name: 'Connor',
                    email: 'sarah@example.com'
                }
            }
        });
        assert.strictEqual(resp.status, 200);
        lastUpstream = upstreamRequests[upstreamRequests.length - 1];
        assert.strictEqual(lastUpstream.url, 'https://api.matterminer.com/api/v1/prospects');
        assert.strictEqual(lastUpstream.data.contact_data.first_name, 'Sarah');

        // 8b. POST /tasks
        console.log('[Smoke 8b] POST /tasks');
        resp = await sendRequest(baseUrl, 'POST', '/tasks', {
            headers: authHeaders,
            body: {
                name: 'Review Contract Documents',
                description: 'Review and analyze the client contract documents',
                is_matter_related: 'Yes',
                priority_id: 1,
                task_category_id: 2,
                task_owner: 7,
                client_id: 5,
                matter_id: 12,
                observer_ids: [3, 4]
            }
        });
        assert.strictEqual(resp.status, 200);
        lastUpstream = upstreamRequests[upstreamRequests.length - 1];
        assert.strictEqual(lastUpstream.url, 'https://api.matterminer.com/api/v1/tasks');
        assert.strictEqual(lastUpstream.data.is_matter_related, true);
        assert.strictEqual(lastUpstream.data.priority_id, 1);
        assert.strictEqual(lastUpstream.data.task_category_id, 2);
        assert.strictEqual(lastUpstream.data.task_owner, 7);
        assert.deepStrictEqual(lastUpstream.data.observer_ids, [3, 4]);

        // 9. GET Lookup Endpoints
        console.log('[Smoke 9] All 13 GET lookup endpoints (/api/v1/*)');
        mockUpstreamHandler = () => ({
            status: 200,
            data: { data: [{ id: 42, name: 'Litigation' }] }
        });

        const getEndpoints = [
            { path: '/countries?search=Kenya', expectedKey: 'country_id', expectedUrlPart: '/api/v1/countries?' },
            { path: '/search-contact?search=jane@example.com', expectedKey: 'contact_id', expectedUrlPart: '/api/v1/contacts?' },
            { path: '/client?is_search=1&search=Acme', expectedKey: 'client_id', expectedUrlPart: '/api/v1/clients?' },
            { path: '/matter-info?is_search=1&search=Dispute', expectedKey: 'matter_id', expectedUrlPart: '/api/v1/matters?' },
            { path: '/case-stage?is_search=1&search=Discovery', expectedKey: 'case_stage_id', expectedUrlPart: '/api/v1/case-stages?' },
            { path: '/practice-area?is_search=1&search=Litigation', expectedKey: 'practice_area_id', expectedUrlPart: '/api/v1/practice-areas?' },
            { path: '/billing-info?is_search=1&search=Hourly', expectedKey: 'billing_type_id', expectedUrlPart: '/api/v1/billing-types?' },
            { path: '/billing-types?is_search=1&search=Hourly', expectedKey: 'billing_type_id', expectedUrlPart: '/api/v1/billing-types?' },
            { path: '/lead-sources?is_search=1&search=Referral', expectedKey: 'lead_source_id', expectedUrlPart: '/api/v1/lead-sources?' },
            { path: '/lead-statuses?is_search=1&search=Open', expectedKey: 'lead_status_id', expectedUrlPart: '/api/v1/lead-statuses?' },
            { path: '/task-categories?is_search=1&search=Review', expectedKey: 'task_category_id', expectedUrlPart: '/api/v1/task-categories?' },
            { path: '/task-priorities?is_search=1&search=High', expectedKey: 'priority_id', expectedUrlPart: '/api/v1/task-priority-levels?' },
            { path: '/task-statuses?is_search=1&search=Pending', expectedKey: 'task_status_id', expectedUrlPart: '/api/v1/task-status-levels?' }
        ];

        for (const ep of getEndpoints) {
            resp = await sendRequest(baseUrl, 'GET', ep.path, { headers: authHeaders });
            assert.strictEqual(resp.status, 200, `Failed on GET ${ep.path}`);
            assert.strictEqual(resp.body[ep.expectedKey], 42, `Missing ${ep.expectedKey} on GET ${ep.path}`);
            lastUpstream = upstreamRequests[upstreamRequests.length - 1];
            assert(lastUpstream.url.includes(ep.expectedUrlPart), `Expected URL ${lastUpstream.url} to include ${ep.expectedUrlPart}`);
        }

        // 10. Negative Smoke Tests: Missing tenant header
        console.log('[Smoke 10] Missing x-tenant-id header returns 400 across endpoints');
        resp = await sendRequest(baseUrl, 'GET', '/countries', { headers: { 'x-user-email': 'a@b.com' } });
        assert.strictEqual(resp.status, 400);
        assert.strictEqual(resp.body.message, 'Tenant ID must be provided');

        console.log('=== ALL 10 END-TO-END HTTP SMOKE TESTS PASSED SUCCESSFULLY ===');
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
}

runSmokeTests().catch((err) => {
    console.error('SMOKE TEST FAILED:', err);
    process.exit(1);
});

