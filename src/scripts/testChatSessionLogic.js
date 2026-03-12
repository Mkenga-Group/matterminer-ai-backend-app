const assert = require('assert');

// 1. Mock the ChatSession model
const mockData = {};
let nextId = 1;

class MockChatSession {
    static async findOne(options) {
        const { tenantId, threadId } = options.where;
        for (const key in mockData) {
            const item = mockData[key];
            if (item.tenantId === tenantId && item.threadId === threadId) {
                // Attach mock methods without copying
                item.update = async (data) => Object.assign(item, data);
                item.save = async () => {};
                item.changed = () => {};
                item.destroy = async () => { delete mockData[item.id]; };
                return item;
            }
        }
        return null;
    }

    static async create(data) {
        const id = nextId++;
        const item = { id, ...data, createdAt: new Date(), updatedAt: new Date() };
        mockData[id] = item;
        return {
            ...item,
            update: async (d) => Object.assign(item, d),
            save: async () => {},
            changed: () => {},
            destroy: async () => { delete mockData[id]; }
        };
    }

    static async findAll(options) {
        const { tenantId } = options.where;
        let results = [];
        for (const key in mockData) {
            const item = mockData[key];
            if (item.tenantId === tenantId) {
                results.push(item);
            }
        }
        // sort by updatedAt desc
        results.sort((a,b) => b.updatedAt - a.updatedAt);
        return results;
    }

    static async destroy(options) {
        const { tenantId, threadId } = options.where;
        for (const key in mockData) {
            const item = mockData[key];
            if (item.tenantId === tenantId && item.threadId === threadId) {
                delete mockData[key];
            }
        }
    }
}

// Intercept require('../models') directly
const path = require('path');
const modelsPath = path.resolve(__dirname, '../models', 'index.js');
require.cache[modelsPath] = {
    id: modelsPath,
    filename: modelsPath,
    loaded: true,
    exports: { ChatSession: MockChatSession }
};

// Now require controller
const controller = require('../controllers/chatSessionController');

async function runTests() {
    console.log('--- Unit Testing chatSessionController ---');

    console.log('Test 1: syncChatSession (New Session)');
    let req = {
        body: {
            tenantId: 'tenant_1',
            threadId: 'draft_A',
            first_name: 'John',
            metadata: { active_workflow: 'client', chat_history: ['Hello'] }
        }
    };
    let jsonResult = null;
    let res = { status: () => res, json: (data) => { jsonResult = data; return res; } };

    await controller.syncChatSession(req, res);
    assert(jsonResult.tenantId === 'tenant_1', 'Tenant mismatch');
    assert(jsonResult.threadId === 'draft_A', 'Thread mismatch');
    assert(jsonResult.first_name === 'John', 'First name save fail');
    console.log('PASS: syncChatSession correctly creates a new session');

    console.log('Test 2: syncChatSession (Update existing session)');
    req.body = {
        tenantId: 'tenant_1',
        threadId: 'draft_A',
        last_name: 'Doe',
        metadata: { active_workflow: 'client', event_draft: { title: 'Meet' } }
    };
    await controller.syncChatSession(req, res);
    assert(jsonResult.first_name === 'John', 'Original first name lost!');
    assert(jsonResult.last_name === 'Doe', 'Last name not saved');
    assert(jsonResult.metadata.chat_history.length === 1, 'Chat history wiped!');
    assert(jsonResult.metadata.event_draft.title === 'Meet', 'Event draft not merged!');
    console.log('PASS: syncChatSession safely merges unified metadata');

    console.log('Test 3: getPendingSessions (Filtering logic)');
    // Add another draft for same tenant
    req.body = {
        tenantId: 'tenant_1',
        threadId: 'draft_B',
        metadata: { active_workflow: 'calendar', event_draft: { title: 'Project Kickoff' } }
    };
    await controller.syncChatSession(req, res);
    
    // Add a cleared draft
    req.body = {
        tenantId: 'tenant_1',
        threadId: 'draft_C',
        metadata: { active_workflow: 'cleared' }
    };
    await controller.syncChatSession(req, res);

    // Call getPendingSessions
    let pendingReq = { query: { tenantId: 'tenant_1' } };
    await controller.getPendingSessions(pendingReq, res);
    
    assert(jsonResult.success, 'Failed to fetch pending');
    assert(jsonResult.drafts.length === 2, `Expected 2 pending drafts, got ${jsonResult.drafts.length}`);
    const draftBTitles = jsonResult.drafts.map(d => d.draftTitle);
    assert(draftBTitles.includes('Meeting: Project Kickoff'), 'Draft title for calendar not generated');
    assert(draftBTitles.includes('Client: John Doe'), 'Draft title for client not generated');
    console.log('PASS: getPendingSessions correctly filters and formats drafts');

    console.log('Test 4: clearChatSession (Delete specific thread)');
    let clearReq = { query: { tenantId: 'tenant_1', threadId: 'draft_A' } };
    await controller.clearChatSession(clearReq, res);

    await controller.getPendingSessions(pendingReq, res);
    assert(jsonResult.drafts.length === 1, 'clearChatSession failed or cleared wrong threads');
    assert(jsonResult.drafts[0].threadId === 'draft_B', 'Cleared wrong thread');
    console.log('PASS: clearChatSession isolated properly via threadId');

    console.log('--- ALL TESTS PASSED ---');
}

runTests().catch(e => {
    console.error('TEST FAILED:', e);
    process.exit(1);
});
