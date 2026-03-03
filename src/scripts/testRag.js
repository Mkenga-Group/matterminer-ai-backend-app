// src/scripts/test_rag.js
const { Pinecone } = require('@pinecone-database/pinecone');
const { OpenAIEmbeddings } = require("@langchain/openai");
require('dotenv').config();

const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pc.index("nuru-knowledge-base");
const embeddings = new OpenAIEmbeddings({ modelName: "text-embedding-3-small" });

async function simulateNuruSearch(userQuery, tenantId) {
    console.log(`--- SIMULATING NURU SEARCH ---`);
    console.log(`Query: "${userQuery}"`);
    console.log(`Tenant: ${tenantId}`);

    try {
        const queryVector = await embeddings.embedQuery(userQuery);

        // This matches the logic Nuru will use in production
        const searchResponse = await index.namespace("workflow_protocols").query({
            vector: queryVector,
            topK: 2,
            includeMetadata: true,
            filter: {
                tenantId: { "$in": ["SYSTEM_GLOBAL", tenantId] }
            }
        });

        if (searchResponse.matches.length === 0) {
            console.log("❌ No matching protocols found.");
            return;
        }

        console.log(`✅ Found ${searchResponse.matches.length} matches:`);
        searchResponse.matches.forEach((match, i) => {
            console.log(`\nMatch ${i + 1} (Score: ${match.score.toFixed(4)}):`);
            console.log(match.metadata.text);
        });

    } catch (error) {
        console.error("Test Search Failed:", error);
    }
}

// RUN TEST
// Replace 'TEST_TENANT_123' with a real ID you've ingested or use SYSTEM_GLOBAL
simulateNuruSearch("How do I handle tedious form filling for client addresses?", "12345678");
