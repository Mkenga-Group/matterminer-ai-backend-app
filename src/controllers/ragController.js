const { Pinecone } = require('@pinecone-database/pinecone');
const { OpenAIEmbeddings } = require("@langchain/openai");

let pc, index, embeddings;

function getPineconeIndex() {
    if (!pc) {
        if (!process.env.PINECONE_API_KEY) throw new Error('PINECONE_API_KEY is not defined');
        pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
        index = pc.index("nuru-knowledge-base");
    }
    return index;
}

function getEmbeddings() {
    if (!embeddings) {
        if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not defined');
        embeddings = new OpenAIEmbeddings({ modelName: "text-embedding-3-small" });
    }
    return embeddings;
}

/**
 * Serves semantic search results to the Python AI Agent
 */
exports.lookupProtocol = async (req, res) => {
    try {
        const { query, tenantId } = req.query;

        if (!query || !tenantId) {
            return res.status(400).json({ error: "Missing query or tenantId" });
        }

        const currentEmbeddings = getEmbeddings();
        const currentIndex = getPineconeIndex();

        const queryVector = await currentEmbeddings.embedQuery(query);

        const searchResponse = await currentIndex.namespace("workflow_protocols").query({
            vector: queryVector,
            topK: 3,
            includeMetadata: true,
            filter: {
                tenantId: { "$in": ["SYSTEM_GLOBAL", tenantId] }
            }
        });

        // Format the results into a clean string for the LLM to read
        const context = searchResponse.matches
            .map(match => `[Protocol: ${match.metadata.category}] ${match.metadata.text}`)
            .join("\n---\n");

        res.json({
            success: true,
            context: context || "No relevant protocols found for this query."
        });

    } catch (error) {
        console.error("RAG Controller Error:", error);
        res.status(500).json({ error: "Internal retrieval error" });
    }
};
