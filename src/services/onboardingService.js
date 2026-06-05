const { ensureWalletExists } = require('./walletService');
const { ingestProtocols } = require('../scripts/ingestKnowledge');

/**
 * Triggered during first login or when a tenant is 'activated'.
 */
async function initializeTenantKnowledge(tenantId) {
    try {
        // 1. Ensure Wallet (Existing logic)
        await ensureWalletExists(tenantId);

        // 2. Clone System Protocols for this Tenant (Optional)
        // Or simply rely on the 'SYSTEM' namespace for global rules.
        // If the tenant has specific custom instructions, ingest them here:
        // await ingestProtocols(tenantId, customTenantData);

        console.log(`Knowledge base verified for tenant: ${tenantId}`);
    } catch (error) {
        console.error("Onboarding knowledge sync failed:", error);
    }
}
