const crypto = require('crypto');

// Setup env vars so basicAuth doesn't throw at initialization
process.env.EXTERNAL_API_USER = 'matterminer_webhook_user_change_me';
process.env.EXTERNAL_API_PASS = 'matterminer_webhook_pass_change_me';

const basicAuth = require('./src/middleware/basicAuth');

function createMockReq(headers) {
    return {
        headers: headers || {},
        socket: { remoteAddress: '127.0.0.1' }
    };
}

function createMockRes() {
    return {
        statusValue: null,
        jsonValue: null,
        headers: {},
        status: function(code) {
            this.statusValue = code;
            return this;
        },
        json: function(data) {
            this.jsonValue = data;
            return this;
        },
        set: function(key, val) {
            this.headers[key] = val;
        }
    };
}

let testsPassed = 0;
let testsFailed = 0;

function runTest(name, req, expectedStatus, expectedNext) {
    const res = createMockRes();
    let nextCalled = false;
    const next = () => { nextCalled = true; };

    try {
        basicAuth(req, res, next);
        
        let pass = true;
        if (expectedNext && !nextCalled) pass = false;
        if (!expectedNext && nextCalled) pass = false;
        if (expectedStatus && res.statusValue !== expectedStatus) pass = false;

        if (pass) {
            console.log(`[PASS] ${name}`);
            testsPassed++;
        } else {
            console.error(`[FAIL] ${name} | Expected next: ${expectedNext}, Got next: ${nextCalled} | Expected status: ${expectedStatus}, Got status: ${res.statusValue}`);
            testsFailed++;
        }
    } catch (err) {
        console.error(`[FAIL] ${name} threw an exception:`, err);
        testsFailed++;
    }
}

console.log("--- Starting Smoke Test ---\n");

runTest("Missing Authorization header", createMockReq({}), 401, false);

runTest("Wrong auth type (Bearer)", createMockReq({ authorization: 'Bearer some_token' }), 401, false);

const hugeHeader = 'Basic ' + 'A'.repeat(300);
runTest("Header exceeds maximum length (DoS Protection)", createMockReq({ authorization: hugeHeader }), 401, false);

const badBase64 = Buffer.from('just_some_string').toString('base64');
runTest("Malformed credentials format", createMockReq({ authorization: 'Basic ' + badBase64 }), 401, false);

const wrongPass = Buffer.from('matterminer_webhook_user_change_me:wrongpass').toString('base64');
runTest("Valid username, Wrong password", createMockReq({ authorization: 'Basic ' + wrongPass }), 401, false);

const wrongUser = Buffer.from('wronguser:matterminer_webhook_pass_change_me').toString('base64');
runTest("Wrong username, Valid password", createMockReq({ authorization: 'Basic ' + wrongUser }), 401, false);

const correctCreds = Buffer.from('matterminer_webhook_user_change_me:matterminer_webhook_pass_change_me').toString('base64');
runTest("Correct credentials", createMockReq({ authorization: 'Basic ' + correctCreds }), null, true);

console.log(`\nTests Passed: ${testsPassed} | Tests Failed: ${testsFailed}`);
if (testsFailed > 0) process.exit(1);
