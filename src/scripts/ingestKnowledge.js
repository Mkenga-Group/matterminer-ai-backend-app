// src/scripts/ingestKnowledge.js
const { Pinecone } = require('@pinecone-database/pinecone');
const { OpenAIEmbeddings } = require("@langchain/openai");
const workflowData = require('../data/knowledge/workflowKnowledge');
const { redactPII, sanitizeLegalJSON } = require('../utils/piiSanitizer');
require('dotenv').config();

// Initialize Pinecone
const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

// REPLACE THIS with the Host URL from your Pinecone Dashboard
const INDEX_HOST = "https://nuru-knowledge-base-ojk656w.svc.aped-4627-b74a.pinecone.io";
const index = pc.index("nuru-knowledge-base", INDEX_HOST);

const embeddings = new OpenAIEmbeddings({ modelName: "text-embedding-3-small" });

async function ingestProtocols(tenantId) {
    try {
        console.log(`Step 1: Generating embeddings for ${workflowData.length} records...`);

        const records = [];
        for (let i = 0; i < workflowData.length; i++) {
            const item = workflowData[i];
            const content = `Category: ${item.category}\nAction: ${item.action}\nProblem: ${item.problem}\nSolution: ${item.solution}`;
            
            const safeContent = redactPII(content);
            const vectorValues = await embeddings.embedQuery(safeContent);
            
            records.push({
                id: `protocol-${tenantId}-${i}`,
                values: vectorValues, // These are the vector numbers
                metadata: {
                    text: safeContent,
                    tenantId: tenantId,
                    category: item.category
                }
            });
        }

        console.log(`Step 2: Prepared ${records.length} records.`);

        // THE FIX FOR SDK v4:
        // 1. Use the key 'records' instead of 'vectors'
        // 2. Pass it inside an object that also contains the 'namespace'
        console.log("Sending to Pinecone...");
        
        await index.upsert({
            records: records, // <--- This must be 'records' in v4
            namespace: "workflow_protocols"
        });

        console.log("✅ SUCCESS: Data is officially in Pinecone.");

    } catch (error) {
        console.error("❌ INGESTION FAILED:");
        console.error(error.message);
    }
}

/**
 * Ingests raw JSON data from the legal module into Pinecone.
 * Implements the hybrid PII sanitization and true Namespace multi-tenancy.
 * 
 * @param {string} tenantId - The tenant's isolated namespace
 * @param {string} dataType - e.g., 'matter', 'client', 'prospect'
 * @param {Object|Array} jsonData - The raw JSON from the legal module
 */
async function ingestLegalData(tenantId, dataType, jsonData) {
    try {
        console.log(`[${tenantId}] Ingesting ${dataType} legal data...`);

        // 1. Sanitize the JSON entirely (Hybrid approach: Key-based + Regex)
        const safeJson = sanitizeLegalJSON(jsonData);

        // 2. Format into a string block for semantic embedding
        const rawArray = Array.isArray(safeJson) ? safeJson : [safeJson];
        const records = [];

        for (let i = 0; i < rawArray.length; i++) {
            const item = rawArray[i];
            const contentString = JSON.stringify(item, null, 2);
            
            const vectorValues = await embeddings.embedQuery(contentString);
            
            records.push({
                id: `legal-${dataType}-${tenantId}-${Date.now()}-${i}`,
                values: vectorValues,
                metadata: {
                    type: dataType,
                    tenantId: tenantId, // Kept for backwards compatibility
                    text: contentString
                }
            });
        }

        // 3. Upsert using TRUE Pinecone Namespaces for hard isolation
        await index.upsert({
            records: records,
            namespace: tenantId // <--- Scalable multi-tenancy partition
        });

        console.log(`✅ [${tenantId}] SUCCESS: Sanitized legal data stored in isolated namespace.`);

    } catch (error) {
        console.error(`❌ [${tenantId}] LEGAL INGESTION FAILED:`, error);
    }
}

// Execute legacy static ingestion for demonstration
ingestProtocols("SYSTEM_GLOBAL");

// Export for external use
module.exports = {
    ingestProtocols,
    ingestLegalData
};
