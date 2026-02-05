const redis = require('redis');
console.log(process.env.REDIS_HOST);
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
   const key = `tenant:${tenantId}:google_tokens`;
   // Google tokens usually contain 'expiry_date' (a timestamp in ms)
   // We set Redis to expire 1 minute before the actual token expires
   // If no expiry provided, default to 1 hour (3600 seconds)
	              
   const ttl = tokens.expiry_date 
      ? Math.floor((tokens.expiry_date - Date.now()) / 1000) - 60 
      : 3600;

   // Use a minimum TTL of 0 to avoid Redis errors
   const safeTTL = Math.max(ttl, 0);

   await client.set(key, JSON.stringify(tokens), {
      EX: safeTTL
   });
	    
   console.log(`Tokens stored in Redis for tenant: ${tenantId} (TTL: ${safeTTL}s)`);
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

module.exports = { storeTokens, getTokens, deleteTokens };
