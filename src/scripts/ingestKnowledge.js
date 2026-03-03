// src/scripts/ingestKnowledge.js
const { Pinecone } = require('@pinecone-database/pinecone');
const { OpenAIEmbeddings } = require("@langchain/openai");
const workflowData = require('../data/knowledge/workflowKnowledge');
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
            
            const vectorValues = await embeddings.embedQuery(content);
            
            records.push({
                id: `protocol-${tenantId}-${i}`,
                values: vectorValues, // These are the vector numbers
                metadata: {
                    text: content,
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

ingestProtocols("SYSTEM_GLOBAL");
