const { ChatSession } = require('../models');

/**
 * Creates or updates (upserts) a chat session based on tenantId.
 * This implementation simulates the 'findOneAndUpdate' behavior for Sequelize/MySQL.
 */
exports.createChatSession = async (req, res) => {
    try {
        const { tenantId, first_name, last_name, client_number, client_type, email, metadata } = req.body;

        if (!tenantId) {
            return res.status(400).json({
                success: false,
                message: "tenantId is required to sync session."
            });
        }

        const sessionData = {
            tenantId,
            first_name: first_name || null,
            last_name: last_name || null,
            client_number: client_number || null,
            client_type: client_type || null,
            email: email || null,
            metadata: metadata || {}
        };

        // 1. Simulation of findOneAndUpdate({ tenantId }, { $set: sessionData }, { upsert: true })
        // Since tenantId is not unique (allowing multiple sessions), this will target the existing session for this tenant
        let session = await ChatSession.findOne({ where: { tenantId } });

        if (session) {
            // Update existing
            await session.update(sessionData);
            console.log(`[CHAT-SESSION-POST] Updated session for ${tenantId}.`);
        } else {
            // Create new
            session = await ChatSession.create(sessionData);
            console.log(`[CHAT-SESSION-POST] Created new session for ${tenantId}.`);
        }

        return res.json({
            success: true,
            message: "Chat session synchronized successfully.",
            data: session
        });
    } catch (error) {
        console.error('Error in createChatSession:', error);
        return res.status(500).json({
            success: false,
            message: "Failed to synchronize chat session.",
            details: error.message
        });
    }
};

/**
 * Retrieves the most recent chat session for a tenant.
 */
exports.getChatSession = async (req, res) => {
    try {
        const tenantId = req.query.tenant_id || req.params.tenant_id || req.body.tenant_id;

        if (!tenantId) {
            return res.status(400).json({
                success: false,
                message: "tenantId is required for session recovery."
            });
        }

        // Fetch the most recent session for this tenant
        const session = await ChatSession.findOne({ 
            where: { tenantId },
            order: [['updatedAt', 'DESC']]
        });

        if (!session) {
            return res.json({
                success: true,
                message: "No active session found.",
                data: null
            });
        }

        return res.json({
            success: true,
            id: session.id,
            tenantId: session.tenantId,
            first_name: session.first_name || null,
            last_name: session.last_name || null,
            client_number: session.client_number || null,
            client_type: session.client_type || null,
            email: session.email || null,
            metadata: session.metadata || {}
        });
    } catch (error) {
        console.error('Error in getChatSession:', error);
        return res.status(500).json({
            success: false,
            message: "Failed to retrieve chat session.",
            details: error.message
        });
    }
};

/**
 * Deletes the most recent chat session for a tenant.
 */
exports.deleteChatSession = async (req, res) => {
    try {
        const { tenantId } = req.body || req.query;

        if (!tenantId) {
            return res.status(400).json({
                success: false,
                message: "tenantId is required to delete session."
            });
        }

        // Targeting the most recent one to delete
        const session = await ChatSession.findOne({ 
            where: { tenantId },
            order: [['updatedAt', 'DESC']]
        });

        if (session) {
            await session.destroy();
            console.log(`[CHAT-SESSION-DELETE] Deleted most recent session for ${tenantId}`);
        }

        return res.json({
            success: true,
            message: "Chat session deleted successfully.",
            data: null
        });
    } catch (error) {
        console.error('Error in deleteChatSession:', error);
        return res.status(500).json({
            success: false,
            message: "Failed to delete chat session.",
            details: error.message
        });
    }
};