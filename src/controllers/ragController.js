const { Pinecone } = require('@pinecone-database/pinecone');
const { OpenAIEmbeddings } = require("@langchain/openai");

const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pc.index("nuru-knowledge-base");
const embeddings = new OpenAIEmbeddings({ modelName: "text-embedding-3-small" });

/**
 * Serves semantic search results to the Python AI Agent
 */
exports.lookupProtocol = async (req, res) => {
    try {
        const { query, tenantId } = req.query;

        if (!query || !tenantId) {
            return res.status(400).json({ error: "Missing query or tenantId" });
        }

        const queryVector = await embeddings.embedQuery(query);

        const searchResponse = await index.namespace("workflow_protocols").query({
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
