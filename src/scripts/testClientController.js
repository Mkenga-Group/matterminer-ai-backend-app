const assert = require('assert');
const path = require('path');

process.env.BASE_URL = 'https://api.matterminer.com';
process.env.CORE_API_KEY = 'test_core_api_key';

// Track mock calls
const destroyedTenants = [];
const apiCalls = [];
let mockApiResponse = { status: 200, message: 'OK', data: {} };
const redisStore = {};

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
                destroyedTenants.push(where.tenantId);
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
            apiCalls.push({ url, method, data, customHeaders, apiKey, tenantId });
            return typeof mockApiResponse === 'function'
                ? mockApiResponse(url, method, data)
                : mockApiResponse;
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
            redisStore[email] = tokenObj;
        },
        getCoreLogin: async (email) => {
            return redisStore[email] || null;
        }
    }
};

const clientController = require('../controllers/clientController');
const validators = require('../middleware/validateClientRequest');

function createMockRes() {
    const res = {
        statusCode: 200,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.body = payload;
            return this;
        }
    };
    return res;
}

async function runTests() {
    console.log('--- Unit Testing clientController & validateClientRequest ---');

    // Test 1: createEvent -> POST /api/v1/calendar
    console.log('Test 1: createEvent aligns with POST /api/v1/calendar');
    mockApiResponse = { status: 201, message: 'Event created' };
    let req = {
        headers: { 'x-user-email': 'lawyer@firm.com', 'x-tenant-id': 'tenant_100' },
        body: {
            title: 'Initial Hearing',
            start_datetime: '2026-11-10T09:00:00Z',
            end_datetime: '2026-11-10T10:00:00Z',
            description: 'Courtroom 4B',
            location: 'High Court',
            timezone: 'Africa/Nairobi',
            matter_id: 42,
            event_type: 'hearing',
            visibility: 'public'
        }
    };
    let res = createMockRes();
    await clientController.createEvent(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    let lastCall = apiCalls[apiCalls.length - 1];
    assert.strictEqual(lastCall.url, 'https://api.matterminer.com/api/v1/calendar');
    assert.strictEqual(lastCall.data.is_all_day, false);
    assert.strictEqual(lastCall.data.matter_id, 42);
    assert.strictEqual(lastCall.data.event_type, 'hearing');
    assert.strictEqual(lastCall.data.visibility, 'public');
    assert(destroyedTenants.includes('tenant_100'));
    console.log('PASS: createEvent');

    // Test 2: createContact -> POST /api/v1/contacts (live call + dynamic model_type/model_id)
    console.log('Test 2: createContact calls POST /api/v1/contacts with dynamic model_type/model_id');
    mockApiResponse = { status: 201, message: 'Contact created' };
    req = {
        headers: { 'x-user-email': 'lawyer@firm.com', 'x-tenant-id': 'tenant_101' },
        body: {
            contact_type: 'primary',
            first_name: 'Jane',
            last_name: 'Doe',
            client_email: 'jane@example.com',
            country_code: '+254',
            phone_number: '712345678',
            model_type: 'App\\Models\\Client',
            model_id: 99
        }
    };
    res = createMockRes();
    await clientController.createContact(req, res);
    assert.strictEqual(res.statusCode, 200);
    lastCall = apiCalls[apiCalls.length - 1];
    assert.strictEqual(lastCall.url, 'https://api.matterminer.com/api/v1/contacts');
    assert.strictEqual(lastCall.data.email, 'jane@example.com');
    assert.strictEqual(lastCall.data.model_type, 'App\\Models\\Client');
    assert.strictEqual(lastCall.data.model_id, 99);
    console.log('PASS: createContact');

    // Test 3: createClient -> POST /api/v1/clients with nested contact_data
    console.log('Test 3: createClient constructs nested contact_data for POST /api/v1/clients');
    mockApiResponse = { status: 201, message: 'Client created' };
    req = {
        headers: { 'x-user-email': 'lawyer@firm.com', 'x-tenant-id': 'tenant_102' },
        body: {
            client_type: 'company',
            company_name: 'Acme Corp',
            country_id: 1,
            street: '123 Main Street',
            first_name: 'Jane',
            last_name: 'Doe',
            client_email: 'jane@acme.com'
        }
    };
    res = createMockRes();
    await clientController.createClient(req, res);
    assert.strictEqual(res.statusCode, 200);
    lastCall = apiCalls[apiCalls.length - 1];
    assert.strictEqual(lastCall.url, 'https://api.matterminer.com/api/v1/clients');
    assert.strictEqual(lastCall.data.company_name, 'Acme Corp');
    assert.strictEqual(lastCall.data.contact_data.first_name, 'Jane');
    assert.strictEqual(lastCall.data.contact_data.last_name, 'Doe');
    assert.strictEqual(lastCall.data.contact_data.email, 'jane@acme.com');
    console.log('PASS: createClient');

    // Test 4: createMatter -> POST /api/v1/matters
    console.log('Test 4: createMatter aligns with POST /api/v1/matters schema');
    mockApiResponse = { status: 201, message: 'Matter created' };
    req = {
        headers: { 'x-user-email': 'lawyer@firm.com', 'x-tenant-id': 'tenant_103' },
        body: {
            client_id: 10,
            name: 'Acme Commercial Lease',
            practice_area_id: 2,
            case_stage_id: 1,
            billing_type_id: 3,
            access_type: 'public',
            status: 'open',
            matter_budget: { amount: 5000.0, currency: 'USD' }
        }
    };
    res = createMockRes();
    await clientController.createMatter(req, res);
    assert.strictEqual(res.statusCode, 200);
    lastCall = apiCalls[apiCalls.length - 1];
    assert.strictEqual(lastCall.url, 'https://api.matterminer.com/api/v1/matters');
    assert.strictEqual(lastCall.data.client_id, 10);
    assert.strictEqual(lastCall.data.name, 'Acme Commercial Lease');
    assert.strictEqual(lastCall.data.practice_area_id, 2);
    assert.strictEqual(lastCall.data.matter_budget.amount, 5000.0);
    console.log('PASS: createMatter');

    // Test 5: createProspect -> POST /api/v1/prospects
    console.log('Test 5: createProspect aligns with POST /api/v1/prospects schema');
    mockApiResponse = { status: 201, message: 'Prospect created' };
    req = {
        headers: { 'x-user-email': 'lawyer@firm.com', 'x-tenant-id': 'tenant_104' },
        body: {
            client_type: 'individual',
            lead_source_id: 1,
            lead_status_id: 2,
            first_name: 'Alice',
            last_name: 'Smith',
            client_email: 'alice@example.com'
        }
    };
    res = createMockRes();
    await clientController.createProspect(req, res);
    assert.strictEqual(res.statusCode, 200);
    lastCall = apiCalls[apiCalls.length - 1];
    assert.strictEqual(lastCall.url, 'https://api.matterminer.com/api/v1/prospects');
    assert.strictEqual(lastCall.data.lead_source_id, 1);
    assert.strictEqual(lastCall.data.contact_data.first_name, 'Alice');
    assert.strictEqual(lastCall.data.contact_data.email, 'alice@example.com');
    console.log('PASS: createProspect');

    // Test 6: login & isLoginSessionValid
    console.log('Test 6: login extracts access_token from data.data.access_token and isLoginSessionValid validates tenantId');
    mockApiResponse = {
        status: 200,
        data: {
            message: 'Login successful',
            data: { access_token: 'jwt_token_xyz' }
        }
    };
    req = { body: { email: 'lawyer@firm.com', password: 'Secret@123' } };
    res = createMockRes();
    await clientController.login(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.access_token, 'jwt_token_xyz');

    req = {
        headers: { 'x-user-email': 'lawyer@firm.com', 'x-tenant-id': 'tenant_104' },
        query: {}
    };
    res = createMockRes();
    await clientController.isLoginSessionValid(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.access_token, 'jwt_token_xyz');
    console.log('PASS: login & isLoginSessionValid');

    // Test 7: searchCountries & getContactIdByEmail handle empty data[] safely with 404
    console.log('Test 7: searchCountries & getContactIdByEmail handle empty array without TypeError');
    mockApiResponse = { status: 200, data: { data: [] } };
    req = {
        headers: { 'x-user-email': 'lawyer@firm.com', 'x-tenant-id': 'tenant_104' },
        query: { search: 'UnknownCountry' }
    };
    res = createMockRes();
    await clientController.searchCountries(req, res);
    assert.strictEqual(res.statusCode, 404);
    assert.strictEqual(res.body.country_id, null);

    res = createMockRes();
    await clientController.getContactIdByEmail(req, res);
    assert.strictEqual(res.statusCode, 404);
    assert.strictEqual(res.body.contact_id, null);
    console.log('PASS: searchCountries & getContactIdByEmail empty result handling');

    // Test 8: Lookup endpoints (getCaseStageInfo, getPracticeAreaInfo, getBillingInfo, getLeadSources, getLeadStatuses)
    console.log('Test 8: Lookup endpoints support both list mode (is_search=0) and ID mode (is_search=1)');
    mockApiResponse = {
        status: 200,
        data: {
            data: [
                { id: 7, name: 'Discovery', extra: 'ignored' },
                { id: 8, name: 'Trial', extra: 'ignored' }
            ]
        }
    };
    req = {
        headers: { 'x-tenant-id': 'tenant_104' },
        query: { is_search: '1', search: 'Discovery' }
    };
    res = createMockRes();
    await clientController.getCaseStageInfo(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.case_stage_id, 7);

    req.query = { is_search: '0' };
    res = createMockRes();
    await clientController.getBillingInfo(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.data.length, 2);
    assert.deepStrictEqual(res.body.data[0], { id: 7, name: 'Discovery' });
    console.log('PASS: Lookup endpoints');

    // Test 9: Joi Validation Middleware
    console.log('Test 9: Joi validation middleware rejects invalid createMatter payload and accepts valid payload');
    let nextCalled = false;
    req = { body: { name: 'Incomplete Matter' } }; // missing client_id, practice_area_id, case_stage_id, billing_type_id
    res = createMockRes();
    validators.validateCreateMatter(req, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.success, false);
    assert(res.body.errors.length >= 4);

    req = {
        body: {
            client_id: 1,
            name: 'Valid Matter',
            practice_area_id: 1,
            case_stage_id: 1,
            billing_type_id: 1
        }
    };
    res = createMockRes();
    validators.validateCreateMatter(req, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, true);

    // Test undefined req.body guard in validateBody
    nextCalled = false;
    req = { body: undefined };
    res = createMockRes();
    validators.validateLogin(req, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 400);

    // Test createClient with existing contact_id (no contact_data or first_name required)
    nextCalled = false;
    req = { body: { country_id: 1, street: '100 Broadway', contact_id: 55 } };
    res = createMockRes();
    validators.validateCreateClient(req, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, true);
    console.log('PASS: Joi validation middleware (including undefined body & contact_id-only edge cases)');

    console.log('--- ALL CLIENT CONTROLLER & VALIDATION TESTS PASSED ---');
}

runTests().catch((err) => {
    console.error('TEST FAILED:', err);
    process.exit(1);
});

