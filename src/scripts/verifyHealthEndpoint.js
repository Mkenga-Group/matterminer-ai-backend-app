const { checkTokenStatus } = require('../services/redisService');

async function test() {
    console.log('Testing checkTokenStatus existence...');
    if (typeof checkTokenStatus === 'function') {
        console.log('SUCCESS: checkTokenStatus is a function.');
    } else {
        console.error('FAILURE: checkTokenStatus is not a function.');
        process.exit(1);
    }
}

test().catch(err => {
    // We expect a connection error if Redis is not running, 
    // but the fact that it reached here means the import worked.
    if (err.message.includes('Redis') || err.message.includes('ECONNREFUSED')) {
        console.log('Import successful. (Redis connection failed as expected in test environment)');
    } else {
        console.error('Unexpected error:', err);
        process.exit(1);
    }
});
