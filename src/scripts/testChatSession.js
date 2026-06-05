const axios = require('axios');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const BASE_URL = 'http://127.0.0.1:3000/calendar'; // Use 127.0.0.1 explicitly
const JWT_SECRET = process.env.JWT_SECRET || 'temp_secret';
const TEST_TENANT_ID = 'test_tenant_chat_' + Date.now();

async function runChatTests() {
    console.log('--- Starting Chat Session Controller Tests ---');

    try {
        console.log('Testing Health Endpoint...');
        const health = await axios.get(`${BASE_URL}/health`);
        console.log('Health:', health.data);
    } catch (e) {
        console.error('Health Check Failed:', e.message);
        return;
    }

    // Generate a valid JWT
    const token = jwt.sign(
        { provider: 'matterminer', tenantId: TEST_TENANT_ID },
        JWT_SECRET,
        { expiresIn: '1h' }
    );

    const config = {
        headers: { Authorization: `Bearer ${token}` }
    };

    try {
        // 1. Create a new session
        console.log('\nTest 1: Create Session');
        const createRes = await axios.post(`${BASE_URL}/chat/session`, {
            tenantId: TEST_TENANT_ID,
            first_name: 'Test',
            last_name: 'User',
            metadata: { active_workflow: 'calendar_creation' }
        }, config);
        console.log('Status:', createRes.status);
        if (createRes.data.success) console.log('PASS: Session created');
        else console.log('FAIL:', createRes.data);

        // 2. Update existing session
        console.log('\nTest 2: Update Session (Sync)');
        const updateRes = await axios.post(`${BASE_URL}/chat/session`, {
            tenantId: TEST_TENANT_ID,
            first_name: 'UpdatedName',
            metadata: { active_workflow: 'event_summarization' }
        }, config);
        if (updateRes.data.data.first_name === 'UpdatedName') console.log('PASS: Session updated (Sync logic works)');
        else console.log('FAIL: Update mismatch', updateRes.data.data);

        // 3. Recover session
        console.log('\nTest 3: Recover Session');
        const recoverRes = await axios.get(`${BASE_URL}/chat/session?tenant_id=${TEST_TENANT_ID}`, config);
        if (recoverRes.data.first_name === 'UpdatedName' && recoverRes.data.metadata.active_workflow === 'event_summarization') {
            console.log('PASS: Session recovered correctly');
        } else {
            console.log('FAIL: Recovery mismatch', recoverRes.data);
        }

        // 4. Delete session
        console.log('\nTest 4: Delete Session');
        const deleteRes = await axios.delete(`${BASE_URL}/chat/session`, {
            data: { tenantId: TEST_TENANT_ID },
            ...config
        });
        if (deleteRes.data.success) console.log('PASS: Session deleted');
        else console.log('FAIL:', deleteRes.data);

        // 5. Verify deletion
        console.log('\nTest 5: Verify Deletion');
        const verifyRes = await axios.get(`${BASE_URL}/chat/session?tenant_id=${TEST_TENANT_ID}`, config);
        if (verifyRes.data.data === null) console.log('PASS: verified session is gone');
        else console.log('FAIL: session still exists');

        console.log('\n--- Chat Session Tests Completed ---');

    } catch (error) {
        if (error.response) {
            console.error('API Error:', error.response.status, error.response.data);
        } else {
            console.error('Test Error:', error.message);
        }
    }
}

runChatTests();
