const { Pinecone } = require('@pinecone-database/pinecone');
require('dotenv').config();

const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

async function initializeIndex() {
    const indexName = "nuru-knowledge-base";

    try {
        const existingIndexes = await pc.listIndexes();
        const indexExists = existingIndexes.indexes.some(idx => idx.name === indexName);

        if (!indexExists) {
            console.log(`Creating index: ${indexName}...`);
            await pc.createIndex({
                name: indexName,
                dimension: 1536, // Required for OpenAI Embeddings
                metric: 'cosine', 
                spec: { 
                    serverless: { 
                        cloud: 'aws', 
                        region: 'us-east-1' 
                    }
                }
            });
            console.log("Index created successfully. Waiting for initialization...");
            // Give the cloud provider a moment to propagate the DNS
            await new Promise(resolve => setTimeout(resolve, 30000));
        } else {
            console.log(`Index "${indexName}" already exists.`);
        }
    } catch (error) {
        console.error("Error setting up Pinecone:", error);
    }
}

initializeIndex();
