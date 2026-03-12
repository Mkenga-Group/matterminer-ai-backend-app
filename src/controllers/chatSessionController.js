// controllers/draftController.js

const { ChatSession } = require('../models');

// Revised syncChatSession Controller (Node.js/Sequelize)
// This version supports the Unified Vault (Client Fields + Event Drafting)
exports.syncChatSession = async (req, res) => {
    // Destructure the unified payload sent by the Python Agent
    const {
        tenantId,
        threadId = 'default',
        client_number,
        client_type,
        first_name,
        last_name,
        email,
        metadata: incomingMetadata
    } = req.body;
    console.log(`[SYNC] Updating Vault for Tenant: ${tenantId}`);
    try {
        // Find existing session or create a new one
        let session = await ChatSession.findOne({ where: { tenantId, threadId } });
        // 1. RECOVER EXISTING STATE (To ensure we don't wipe existing data)
        const existingMetadata = session ? (session.metadata || {}) : {};
        // 2. UNIFIED METADATA MERGE (The "Amnesia-Proof" Core)
        const updatedMetadata = {
            ...existingMetadata, // Preserve existing keys
            // A: Update chat history (conversational thread)
            chat_history: (incomingMetadata && incomingMetadata.chat_history)
                ? incomingMetadata.chat_history
                : (existingMetadata.chat_history || []),
            // B: Update event_draft (pending calendar details)
            event_draft: (incomingMetadata && incomingMetadata.event_draft)
                ? incomingMetadata.event_draft
                : (existingMetadata.event_draft || {}),
            // C: Update active_workflow (Intent Lockdown: 'client' or 'calendar')
            // This prevents "Legal Battles" title from being misidentified as a client name.
            active_workflow: (incomingMetadata && incomingMetadata.active_workflow)
                ? incomingMetadata.active_workflow
                : (existingMetadata.active_workflow || null)
        };
        // 3. DATABASE PERSISTENCE (Safe Merging)
        if (!session) {
            // First time initialization
            session = await ChatSession.create({
                tenantId,
                threadId,
                client_number,
                client_type,
                first_name,
                last_name,
                email,
                metadata: updatedMetadata
            });
        } else {
            // --- TOP-LEVEL COLUMN UPDATES ---
            // Only update if the value is explicitly provided (prevents null overwrites)
            if (client_number !== undefined) session.client_number = client_number;
            if (client_type !== undefined) session.client_type = client_type;
            if (first_name !== undefined) session.first_name = first_name;
            if (last_name !== undefined) session.last_name = last_name;
            if (email !== undefined) session.email = email;
            // --- METADATA (JSON) SYNC ---
            session.metadata = updatedMetadata;
            // CRITICAL: MySQL binary JSON requires an explicit 'changed' flag in Sequelize
            session.changed('metadata', true);
            await session.save();
        }
        // Return the updated "Vault" back to the Python Agent
        res.status(200).json(session);
    } catch (error) {
        console.error("CRITICAL SYNC-ERROR:", error);
        res.status(500).json({
            error: "Failed to sync session state",
            details: error.message
        });
    }
};
/**
 * GET CHAT SESSION (Memory Rehydration)
 * Fetches the latest "Vault" state for a tenant to prevent AI amnesia.
 */
exports.getChatSession = async (req, res) => {
    try {
        const { tenantId, threadId = 'default' } = req.query;
        if (!tenantId) {
            return res.status(400).json({ error: "Missing tenantId parameter" });
        }
        // Fetch the most recent session for this tenant
        const session = await ChatSession.findOne({
            where: { tenantId, threadId },
            order: [['updatedAt', 'DESC']]
        });
        // 1. HARD DEFAULTS (For Fresh Sessions)
        // If no session exists, we return the base schema so the AI doesn't crash on nulls
        if (!session) {
            return res.status(200).json({
                client_number: null,
                client_type: null,
                first_name: null,
                last_name: null,
                email: null,
                metadata: {
                    chat_history: [],
                    event_draft: {},
                    active_workflow: null // Added for task isolation
                }
            });
        }
        // 2. CLEAN CONTEXT MERGE (Source of Truth)
        // We ensure that the metadata object always contains the expected keys,
        // even if they were missing or corrupted in the DB.
        const rawMetadata = session.metadata || {};
        const cleanMetadata = {
            chat_history: rawMetadata.chat_history || [],
            event_draft: rawMetadata.event_draft || {},
            active_workflow: rawMetadata.active_workflow || null // CRITICAL for task gating
        };
        // 3. STRUCTURED RESPONSE
        // Return the unified "Vault" to the Python Agent
        res.status(200).json({
            id: session.id,
            tenantId: session.tenantId,
            client_number: session.client_number,
            client_type: session.client_type,
            first_name: session.first_name,
            last_name: session.last_name,
            email: session.email,
            metadata: cleanMetadata
        });
    } catch (error) {
        console.error("CRITICAL GET-SESSION-ERROR:", error);
        res.status(500).json({
            error: "Failed to retrieve vault state",
            details: error.message
        });
    }
};

/**
 * Clears the chat session and event draft for a tenant.
 * This is called when the user confirms an event or cancels the session.
 */
exports.clearChatSession = async (req, res) => {
    const tenantId = req.query.tenantId || req.body.tenantId;
    const threadId = req.query.threadId || req.body.threadId || 'default';
    try {
        if (!tenantId) {
            return res.status(400).json({ success: false, message: "tenantId is required" });
        }
        await ChatSession.destroy({ where: { tenantId, threadId } });
        res.status(200).json({ success: true, message: "Session cleared." });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getPendingSessions = async (req, res) => {
    try {
        const { tenantId } = req.query;

        if (!tenantId) {
            return res.status(400).json({ success: false, message: 'tenantId is required' });
        }

        // Fetch all sessions that aren't explicitly cleared/null
        const pendingSessions = await ChatSession.findAll({
            where: {
                tenantId: tenantId,
                // Optional: Filter out where active_workflow is 'cleared' depending on JSON dialect
                // 'metadata.active_workflow': { [Op.not]: 'cleared' }
            },
            order: [['updatedAt', 'DESC']] // Most recent first
        });

        // Map it to a clean tabular format for the frontend UI
        const tableData = pendingSessions
            // Filter out truly dead sessions in memory to be safe (only exclude if explicitly 'cleared')
            .filter(s => s.metadata?.active_workflow !== 'cleared')
            .map(session => {
                const workflowType = session.metadata?.active_workflow || 'unknown';
                let draftTitle = 'Unknown Draft';

                if (workflowType === 'calendar') {
                    draftTitle = session.metadata.event_draft?.title
                        ? `Meeting: ${session.metadata.event_draft.title}`
                        : 'Unscheduled Meeting';
                } else if (workflowType === 'client') {
                    draftTitle = session.first_name || session.last_name
                        ? `Client: ${session.first_name || ''} ${session.last_name || ''}`.trim()
                        : 'Client: Details Pending';
                }

                return {
                    threadId: session.threadId,
                    workflowType: workflowType.charAt(0).toUpperCase() + workflowType.slice(1), // Capitalize
                    draftTitle: draftTitle,
                    startedOn: session.createdAt,
                    lastActivity: session.updatedAt
                };
            });

        return res.status(200).json({ success: true, drafts: tableData });
    } catch (error) {
        console.error('[Session-PENDING] Error:', error);
        return res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

