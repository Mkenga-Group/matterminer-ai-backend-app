const { Pinecone } = require('@pinecone-database/pinecone');
require('dotenv').config();

const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

async function diagnose() {
    try {
        const indexes = await pc.listIndexes();
        console.log("Your API Key sees these indexes:");
        console.log(indexes.indexes.map(i => i.name));
        
        const target = "nuru-knowledge-base";
        if (!indexes.indexes.some(i => i.name === target)) {
            console.log(`❌ ERROR: "${target}" is NOT in the list above.`);
        } else {
            console.log(`✅ SUCCESS: "${target}" found. Ready for test_rag.js.`);
        }
    } catch (e) {
        console.error("Connection failed. Check your API Key.", e.message);
    }
}
diagnose();
