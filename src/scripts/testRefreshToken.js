const axios = require('axios');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const BASE_URL = 'http://localhost:3000/calendar/auth'; // Corrected URL based on routes/index.js
const JWT_SECRET = process.env.JWT_SECRET || 'temp_secret';
const TEST_TENANT_ID = 'test_tenant_' + Date.now();

console.log('Using JWT_SECRET:', JWT_SECRET);
console.log('Using BASE_URL:', BASE_URL);

async function runTests() {
    console.log('--- Starting Refresh Token Endpoint Tests ---');

    // Generate a valid JWT for the middleware
    const token = jwt.sign(
        { provider: 'matterminer', tenantId: TEST_TENANT_ID },
        JWT_SECRET,
        { expiresIn: '1h' }
    );

    const config = {
        headers: { Authorization: `Bearer ${token}` }
    };

    try {
        // Test Case 1: Missing tenant_id
        console.log('\nTest 1: Missing tenant_id');
        try {
            await axios.post(`${BASE_URL}/googleRefreshToken`, {}, config);
            console.log('FAIL: Should have returned 400');
        } catch (error) {
            if (error.response) {
                console.log('Status:', error.response.status);
                console.log('Body:', error.response.data);
                if (error.response.status === 400) console.log('PASS: Correctly rejected missing tenant_id');
                else console.log('FAIL: Expected 400, got', error.response.status);
            } else {
                console.log('FAIL: No response from server. Is it running? Error:', error.message);
                return;
            }
        }

        // Test Case 2: No valid credentials in Redis
        console.log('\nTest 2: No credentials in Redis');
        try {
            const res = await axios.post(`${BASE_URL}/googleRefreshToken`, { tenant_id: TEST_TENANT_ID }, config);
            console.log('FAIL: Should have returned 401, got', res.status);
        } catch (error) {
            if (error.response) {
                console.log('Status:', error.response.status);
                console.log('Body:', error.response.data);
                if (error.response.status === 401) console.log('PASS: Correctly handled missing tokens in Redis');
                else console.log('FAIL: Expected 401, got', error.response.status);
            } else {
                console.log('FAIL: No response from server.');
            }
        }

        // Test Case 3: Unauthorized (No Bearer Token)
        console.log('\nTest 3: No Auth Header');
        try {
            await axios.post(`${BASE_URL}/googleRefreshToken`, { tenant_id: TEST_TENANT_ID });
            console.log('FAIL: Should have been blocked by middleware');
        } catch (error) {
            if (error.response) {
                console.log('Status:', error.response.status);
                console.log('Body:', error.response.data);
                if (error.response.status === 401) console.log('PASS: Middleware correctly blocked request');
                else console.log('FAIL: Expected 401, got', error.response.status);
            } else {
                console.log('FAIL: No response from server.');
            }
        }

        console.log('\n--- Tests Completed ---');

    } catch (error) {
        console.error('Unexpected error during testing:', error.message);
    }
}

runTests();
