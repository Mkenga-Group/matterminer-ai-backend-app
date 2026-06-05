const { Wallet } = require('../models');
const sequelize = require('../config/database');
/**
 * Deducts tokens from a tenant's wallet
 * @param {string} tenantId 
 * @param {number} totalTokens - The usage.total_tokens from OpenAI
 */
async function depleteTokens(tenantId, totalTokens) {
  try {
    // We add 'AND balance > 0' to the WHERE clause
    const [result, metadata] = await sequelize.query(
      `UPDATE wallets
       SET balance = GREATEST(0, balance - :tokens), 
       status = CASE WHEN (balance - :tokens) <= 0 THEN 'depleted' ELSE status END
       WHERE tenantId = :tenantId AND balance > 0`, 
      {
        replacements: { tokens: totalTokens, tenantId: tenantId },
        type: sequelize.QueryTypes.UPDATE
      }
    );

    // Metadata contains information about how many rows were affected
    // In many dialects (MySQL/Postgres), if 0 rows are affected, the balance was already 0
    if (metadata === 0) {
      return { 
        success: false, 
        error: 'insufficient_funds', 
        message: 'Transaction failed: Balance is already zero.' 
      };
    }
    return { success: true, affectedRows: metadata };
  } catch (error) {
    console.error('Wallet depletion failure:', error);
    throw error;
  }
}

const RESERVE_AMOUNT = 1500; // Average max tokens for a legal agent response

async function hasSufficientBalance(tenantId) {
    const wallet = await Wallet.findOne({ where: { tenantId } });
    
    if (!wallet) return { allowed: false, error: 'no_wallet' };
    if (wallet.status !== 'active') return { allowed: false, error: 'wallet_suspended' };
    
    // Check if they have at least the reserve amount
    if (wallet.balance < RESERVE_AMOUNT) {
        return { 
            allowed: false, 
            error: 'insufficient_funds', 
            balance: wallet.balance,
            required: RESERVE_AMOUNT 
        };
    }
    
    return { success: true, allowed: true, balance: wallet.balance, message: 'Tenant wallet balance' };
}
/**
 * Idempotent method to ensure a tenant has a wallet.
 * Called during authentication or on-boarding.
 */
async function ensureWalletExists(tenantId) {
    const [wallet, created] = await Wallet.findOrCreate({
        where: { tenantId },
        defaults: {
            balance: 10000,
            status: 'active'
        }
    });
    return { wallet, created };
}

module.exports = { depleteTokens, hasSufficientBalance, ensureWalletExists };
