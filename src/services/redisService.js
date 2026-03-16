const redis = require('redis');

const { refreshAccessToken } = require('../services/googleOAuth');


/** 
 * Initialize client
 */
const client = redis.createClient({
    password: process.env.REDIS_PASS,
    socket: {
        host: process.env.REDIS_HOST,
        password: process.env.REDIS_PASS
    }
});

client.on('error', (err) => console.error('Redis Client Error', err));

/** 
 * Connect to Redis
 */
(async () => {
    if (!client.isOpen) await client.connect();
})();

/**
 * Stores Google tokens for a specific tenant
 * @param {string} tenantId - Unique ID for the tenant/user
 * @param {object} tokens - The tokens object from Google
 */
async function storeTokens(tenantId, tokens) {
    const accessKey = `tenant:${tenantId}:google_tokens`;
    const refreshKey = `tenant:${tenantId}:refresh_token`;
    // Google tokens usually contain 'expiry_date' (a timestamp in ms)
    // We set Redis to expire 1 minute before the actual token expires
    // If no expiry provided, default to 1 hour (3600 seconds)

    const ttl = tokens.expiry_date
        ? Math.floor((tokens.expiry_date - Date.now()) / 1000) - 60
        : 3600;

    // Use a minimum TTL of 0 to avoid Redis errors
    const safeTTL = Math.max(ttl, 0);

    await client.set(accessKey, JSON.stringify(tokens), { EX: safeTTL });

    if (tokens.refresh_token) {
        // Store for 30 days or longer
        await client.set(refreshKey, tokens.refresh_token, { EX: 2592000 });
    }

    console.log(`Tokens stored in Redis for tenant: ${tenantId}. Refresh token saved.`);
}

/**
 * Retrieves tokens for a specific tenant
 */
async function getTokens(tenantId) {
    const key = `tenant:${tenantId}:google_tokens`;
    const data = await client.get(key);
    return data ? JSON.parse(data) : null;
}

/**
 * Deletes tokens (useful for logout/disconnect)
 */
async function deleteTokens(tenantId) {
    const key = `tenant:${tenantId}:google_tokens`;
    await client.del(key);
}

/**
 * 
 */
async function getValidTokens(tenantId) {
    // 1. Try to get the short-lived access tokens
    let tokens = await getTokens(tenantId);

    // 2. If access tokens expired/missing, try to refresh
    if (!tokens) {
        console.log(`Access token expired for ${tenantId}, attempting refresh...`);
        const refreshToken = await client.get(`tenant:${tenantId}:refresh_token`);

        if (refreshToken) {
            try {
                // Get new tokens from Google
                const newCredentials = await refreshAccessToken(refreshToken);

                // Important: Google doesn't always send the refresh_token back in a refresh call
                // so we merge the new access_token with our existing refresh_token
                const updatedTokens = {
                    ...newCredentials,
                    refresh_token: refreshToken
                };

                // Save back to Redis
                await storeTokens(tenantId, updatedTokens);
                return updatedTokens;
            } catch (error) {
                console.error("Refresh failed. User must re-authenticate.");
                await revokeTokens(tenantId);
                return null;
            }
        }
    }
    return tokens;
}
/**
 * Completely wipes all Google-related tokens for a tenant.
 * Use this for logout or when Google returns an 'invalid_grant' error.
 */
async function revokeTokens(tenantId) {
    const accessKey = `tenant:${tenantId}:google_tokens`;
    const refreshKey = `tenant:${tenantId}:refresh_token`;

    try {
        await Promise.all([
            client.del(accessKey),
            client.del(refreshKey)
        ]);
        console.log(`Successfully revoked all tokens for tenant: ${tenantId}`);
        return true;
    } catch (err) {
        console.error(`Error revoking tokens for ${tenantId}:`, err);
        return false;
    }
}

/**
 * Checks if a refresh token exists and if it is valid by attempting a silent refresh if needed.
 */
async function checkTokenStatus(tenantId) {
    const refreshKey = `tenant:${tenantId}:refresh_token`;
    const refreshToken = await client.get(refreshKey);

    if (!refreshToken) {
        return { exists: false, valid: false };
    }

    // Attempt to get valid tokens - this will trigger a refresh if the access token is missing or expired
    const tokens = await getValidTokens(tenantId);

    return {
        exists: true,
        valid: !!tokens
    };
}

async function storeCoreLogin(email, token) {
    const loginKey = `core:${email}:userLogin`;

    // Set TTL to 2 hours in seconds (2 hours * 60 minutes * 60 seconds)
    const ttlInSeconds = 7200;

    // Use a minimum TTL of 0 to avoid Redis errors (though strictly positive here)
    const safeTTL = Math.max(ttlInSeconds, 0);

    // Store the JSON-stringified tokens with the EX (expiration) option
    await client.set(loginKey, JSON.stringify(token), { EX: safeTTL });

    console.log(`Login tokens stored in redis for user: ${email} saved.`);
}

async function getCoreLogin(email) {
    const loginKey = `core:${email}:userLogin`;
    const data = await client.get(loginKey);
    return data ? JSON.parse(data) : null;
}

module.exports = { storeTokens, getTokens, getValidTokens, deleteTokens, revokeTokens, checkTokenStatus, storeCoreLogin, getCoreLogin };
