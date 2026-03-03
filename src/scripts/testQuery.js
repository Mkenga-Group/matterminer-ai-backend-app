const { Pinecone } = require('@pinecone-database/pinecone');
const { OpenAIEmbeddings } = require("@langchain/openai");
require('dotenv').config();

const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pc.index("nuru-knowledge-base");
const embeddings = new OpenAIEmbeddings({ modelName: "text-embedding-3-small" });

async function queryKnowledge(userQuery, tenantId) {
    try {
        console.log(`\n🔍 Searching for: "${userQuery}"`);

        // 1. Convert the natural language question into a vector
        const queryVector = await embeddings.embedQuery(userQuery);

        // 2. Search Pinecone
        const queryResponse = await index.namespace("workflow_protocols").query({
            vector: queryVector,
            topK: 2, // Get the top 2 most relevant results
            includeMetadata: true,
            filter: {
                tenantId: { "$eq": tenantId } // Metadata filtering
            }
        });

        // 3. Display the results
        if (queryResponse.matches.length > 0) {
            console.log("\n✅ FOUND MATCHES:");
            queryResponse.matches.forEach((match, i) => {
                console.log(`\n[Result ${i + 1}] (Score: ${match.score.toFixed(4)})`);
                console.log(`Content: ${match.metadata.text}`);
            });
        } else {
            console.log("❌ No matching protocols found.");
        }

    } catch (error) {
        console.error("❌ QUERY FAILED:", error.message);
    }
}

// TEST CASES:
// 1. Try a conceptual search
queryKnowledge("How does the AI handle long intake forms?", "SYSTEM_GLOBAL");

// 2. Try a search about practice areas
// queryKnowledge("What happens when someone mentions a lease?", "SYSTEM_GLOBAL");

