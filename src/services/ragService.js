// src/services/rag.service.js
const { Pinecone } = require('@pinecone-database/pinecone');
const { OpenAIEmbeddings } = require("@langchain/openai");

const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pc.index("nuru-knowledge-base");

/**
 * Encapsulates the logic for searching the Vector DB
 */
async function queryKnowledge(query, namespace, tenantId) {
    const embeddings = new OpenAIEmbeddings();
    const queryVector = await embeddings.embedQuery(query);

    // Security: We filter by tenantId metadata to ensure data isolation
    const searchResponse = await index.namespace(namespace).query({
        vector: queryVector,
        topK: 3,
        includeMetadata: true,
        filter: { "$in" : ["SYSTEM_GLOBAL", tenantId] } 
    });

    return searchResponse.matches.map(match => match.metadata.text).join("\n---\n");
}
/**
 * Retrieves the "Plan of Action" for Nuru based on the user's current intent.
 */
async function getAgenticActionPlan(userQuery, tenantId) {
    const queryVector = await embeddings.embedQuery(userQuery);

    const result = await index.namespace("workflow_protocols").query({
        vector: queryVector,
        topK: 1, // We only need the most relevant protocol
        includeMetadata: true,
        filter: { tenantId: { "$eq": tenantId } }
    });

    if (result.matches.length > 0) {
        return result.matches[0].metadata.text;
    }
    return "No specific protocol found. Proceed with standard conversational intake.";
}

module.exports = { queryKnowledge, getAgenticActionPlan };
