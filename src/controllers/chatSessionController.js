// controllers/chatSessionController.js

const { ChatSession } = require('../models');

/**
 * SYNC CHAT SESSION (Memory Persistence)
 *
 * Updates the "Vault" (chatsessions row) with the latest Python agent state.
 * Supports the Unified Vault: Client Fields + Event Draft + Contact Draft + Client Draft.
 *
 * FIX v2: Forward ALL incoming metadata keys (e.g. session_lifecycle, client_draft,
 * contact_draft) to the database instead of only the 3 hardcoded keys.
 * Controlled fields (chat_history, event_draft, active_workflow) still use
 * the conditional merge to prevent accidental overwrites.
 */
exports.syncChatSession = async (req, res) => {
    const {
        /*tenantId,*/
        threadId,
        client_number,
        client_type,
        first_name,
        last_name,
        email,
        metadata: incomingMetadata
    } = req.body;

    const tenantId = req.headers['x-tenant-id'] || req.body.tenantId;	

    console.log(`[SYNC] Updating Vault for Tenant: ${tenantId}, Thread: ${threadId}`);

    try {
        if (!tenantId) {
            return res.status(400).json({ error: "tenantId is required" });
        }

        if (!threadId) {
            return res.status(400).json({ error: "threadId is required" });
        }

        let session = await ChatSession.findOne({ where: { tenantId, threadId } });

        // 1. RECOVER EXISTING STATE
        const existingMetadata = session ? (session.metadata || {}) : {};

        // 2. UNIFIED METADATA MERGE
        //    FIX: Start by spreading ALL existing keys, then spread ALL incoming keys.
        //    This ensures Python-written fields like `session_lifecycle`, `client_draft`,
        //    and `contact_draft` survive the merge and are persisted to the database.
        //    Controlled fields are then applied with conditional merge logic on top.
        const updatedMetadata = {
            ...existingMetadata,                    // Preserve existing stored keys
            ...(incomingMetadata || {}),            // FIX: Forward ALL incoming Python keys first

            // A: Controlled merge for chat_history
            chat_history: (incomingMetadata && incomingMetadata.chat_history !== undefined)
                ? incomingMetadata.chat_history
                : (existingMetadata.chat_history || []),

            // B: Controlled merge for event_draft
            event_draft: (incomingMetadata && incomingMetadata.event_draft !== undefined)
                ? incomingMetadata.event_draft
                : (existingMetadata.event_draft || {}),

            // C: Controlled merge for active_workflow
            //    FIX: Use nullish coalescing (??) instead of ||  to allow explicit "null" resets
            //    from Python. The old || would block a null reset if existingMetadata had a value.
            active_workflow: (incomingMetadata && incomingMetadata.active_workflow !== undefined)
                ? incomingMetadata.active_workflow
                : (existingMetadata.active_workflow ?? null),
        };

        // 3. DATABASE PERSISTENCE (Safe Merging)
        if (!session) {
            try {
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
            } catch (createError) {
                if (createError.name === 'SequelizeUniqueConstraintError') {
                    session = await ChatSession.findOne({ where: { tenantId, threadId } });
                    if (!session) throw createError;
                } else {
                    throw createError;
                }
            }
        } else {
            // TOP-LEVEL COLUMN UPDATES (only update if explicitly provided)
            if (client_number !== undefined) session.client_number = client_number;
            if (client_type !== undefined) session.client_type = client_type;
            if (first_name !== undefined) session.first_name = first_name;
            if (last_name !== undefined) session.last_name = last_name;
            if (email !== undefined) session.email = email;

            // METADATA SYNC
            session.metadata = updatedMetadata;
            session.changed('metadata', true);
            await session.save();
        }

        res.status(200).json(session);
    } catch (error) {
        console.error("CRITICAL SYNC-ERROR:", error);
        res.status(500).json({
            error: "Failed to sync session state",
            details: process.env.NODE_ENV === 'production' ? "Internal server error" : error.message
        });
    }
};

/**
 * GET CHAT SESSION (Memory Rehydration)
 *
 * Fetches the latest "Vault" state for a tenant to prevent AI amnesia.
 *
 * FIX v2: Pass ALL stored metadata keys back to Python, not just the 3 hardcoded
 * ones. This ensures `session_lifecycle`, `client_draft`, `contact_draft` and any
 * other keys Python writes are visible on the next rehydration read.
 */
exports.getChatSession = async (req, res) => {
    try {
        const { threadId } = req.query;
        const tenantId = req.headers['x-tenant-id'] || req.query.tenantId;    

        if (!tenantId) {
            return res.status(400).json({ error: "Missing tenantId parameter" });
        }
        if (!threadId) {
            return res.status(400).json({ error: "Missing threadId parameter" });
        }

        const session = await ChatSession.findOne({ where: { tenantId, threadId } });

        // 1. HARD DEFAULTS (For Fresh Sessions)
        if (!session) {
            return res.status(200).json({
                tenantId,
                threadId,
                client_number: null,
                client_type: null,
                first_name: null,
                last_name: null,
                email: null,
                metadata: {
                    chat_history: [],
                    event_draft: {},
                    active_workflow: null,
                    session_lifecycle: null   // Added so Python always gets this key
                }
            });
        }

        const rawMetadata = session.metadata || {};

        // 2. CLEAN CONTEXT MERGE (Source of Truth)
        //    FIX: Spread ALL stored metadata keys first, then apply safe defaults for the
        //    3 controlled keys. This ensures session_lifecycle, client_draft, contact_draft
        //    and any other Python-written keys survive the roundtrip to the agent.
        const cleanMetadata = {
            ...rawMetadata,                                                  // FIX: Pass ALL keys through
            chat_history: rawMetadata.chat_history || [],                    // Safe default
            event_draft: rawMetadata.event_draft || {},                      // Safe default
            active_workflow: rawMetadata.active_workflow ?? null,            // FIX: ?? allows "cleared" or null resets
            session_lifecycle: rawMetadata.session_lifecycle ?? null         // Added: critical for Python gating
        };

        // 3. STRUCTURED RESPONSE
        res.status(200).json({
            id: session.id,
            tenantId: session.tenantId,
            threadId: session.threadId,
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
            details: process.env.NODE_ENV === 'production' ? "Internal server error" : error.message
        });
    }
};

/**
 * CLEAR CHAT SESSION
 * Hard-deletes the chatsession row for a tenant+thread combination.
 * Called by Python agent on workflow completion.
 */
exports.clearChatSession = async (req, res) => {
    const tenantId = req.headers['x-tenant-id'] || req.query.tenantId || req.body.tenantId;
    const threadId = req.query.threadId || req.body.threadId;

    try {
        if (!tenantId) {
            return res.status(400).json({ success: false, message: "tenantId is required" });
        }
        if (!threadId) {
            return res.status(400).json({ success: false, message: "threadId is required" });
        }

        const deletedCount = await ChatSession.destroy({ where: { tenantId, threadId } });

        if (deletedCount === 0) {
            return res.status(404).json({ success: false, message: "Session not found or already cleared." });
        }

        res.status(200).json({ success: true, message: "Session cleared." });
    } catch (error) {
        res.status(500).json({
            error: "Failed to clear session",
            details: process.env.NODE_ENV === 'production' ? "Internal server error" : error.message
        });
    }
};

/**
 * GET PENDING SESSIONS
 * Returns all active (non-cleared) sessions for a tenant in a tabular format.
 */
exports.getPendingSessions = async (req, res) => {
    try {
        const tenantId = req.headers['x-tenant-id'] || req.query.tenantId;

        if (!tenantId) {
            return res.status(400).json({ success: false, message: 'tenantId is required' });
        }

        const allSessions = await ChatSession.findAll({
            where: { tenantId },
            order: [['updatedAt', 'DESC']]
        });

        // Filter out sessions that are explicitly cleared or completed
        const pendingSessions = allSessions.filter(s => {
            const workflow = s.metadata?.active_workflow;
            const lifecycle = s.metadata?.session_lifecycle;
            return workflow !== 'cleared' && lifecycle !== 'completed';
        });

        const tableData = pendingSessions.map(session => {
            const workflowType = session.metadata?.active_workflow || 'unknown';
            let draftTitle = 'Unknown Draft';

            if (workflowType === 'calendar') {
                draftTitle = session.metadata?.event_draft?.title
                    ? `Meeting: ${session.metadata.event_draft.title}`
                    : 'Unscheduled Meeting';
            } else if (workflowType === 'client') {
                const name = [session.first_name, session.last_name].filter(Boolean).join(' ');
                draftTitle = name ? `Client: ${name}` : 'Client: Details Pending';
            } else if (workflowType === 'contact') {
                const cd = session.metadata?.contact_draft || {};
                const name = [cd.first_name, cd.last_name].filter(Boolean).join(' ');
                draftTitle = name ? `Contact: ${name}` : 'Contact: Details Pending';
            }

            return {
                threadId: session.threadId,
                workflowType: workflowType.charAt(0).toUpperCase() + workflowType.slice(1),
                draftTitle,
                startedOn: session.createdAt,
                lastActivity: session.updatedAt
            };
        });

        return res.status(200).json({ success: true, drafts: tableData });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Server error',
            details: process.env.NODE_ENV === 'production' ? "Internal server error" : error.message
        });
    }
};
