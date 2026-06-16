const crypto = require('crypto');
require('dotenv').config();

// 1. FAIL-FAST: Validate configuration at startup, not during request
const expectedUserString = process.env.EXTERNAL_API_USER;
const expectedPassString = process.env.EXTERNAL_API_PASS;

if (!expectedUserString || !expectedPassString) {
    throw new Error('CRITICAL: EXTERNAL_API_USER or EXTERNAL_API_PASS must be configured in environment variables.');
}

// 2. OPTIMIZATION: Pre-compute the expected hashes once at startup
const expectedUserHash = crypto.createHash('sha256').update(expectedUserString).digest();
const expectedPassHash = crypto.createHash('sha256').update(expectedPassString).digest();

/**
 * Hardened Basic Auth Middleware
 */
module.exports = function basicAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    
    // Fast fail for missing headers
    if (!authHeader || !authHeader.startsWith('Basic ')) {
        return rejectRequest(req, res, 'Missing or incorrect auth type');
    }

    // 3. DoS PREVENTION: Prevent parsing massive headers
    if (authHeader.length > 200) {
        return rejectRequest(req, res, 'Auth header exceeds maximum length');
    }

    const b64auth = authHeader.split(' ')[1];
    if (!b64auth) return rejectRequest(req, res, 'Missing token');

    // Decode base64 payload
    const decoded = Buffer.from(b64auth, 'base64').toString('utf8');
    const separatorIndex = decoded.indexOf(':');
    
    if (separatorIndex === -1) return rejectRequest(req, res, 'Malformed credentials format');

    const providedUser = decoded.slice(0, separatorIndex);
    const providedPass = decoded.slice(separatorIndex + 1);

    // Hash the provided credentials to normalize lengths to 32 bytes
    const providedUserHash = crypto.createHash('sha256').update(providedUser).digest();
    const providedPassHash = crypto.createHash('sha256').update(providedPass).digest();

    // 4. TIMING ATTACK MITIGATION: Compare using timingSafeEqual
    // Both user and pass are evaluated to prevent short-circuit timing leaks
    const isUserValid = crypto.timingSafeEqual(providedUserHash, expectedUserHash);
    const isPassValid = crypto.timingSafeEqual(providedPassHash, expectedPassHash);

    if (isUserValid && isPassValid) {
        return next();
    }

    return rejectRequest(req, res, 'Invalid credentials');
};

/**
 * Standardizes the unauthorized response and logs the attempt
 */
function rejectRequest(req, res, reason) {
    // 5. AUDIT LOGGING: Log the failure reason and IP, but NEVER the attempted credentials
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    console.warn(`[SECURITY] Basic Auth failed from IP: ${ip} | Reason: ${reason}`);

    res.set('WWW-Authenticate', 'Basic realm="External API"');
    return res.status(401).json({ success: false, message: 'Unauthorized external call' });
}
