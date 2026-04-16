-- Enable pgvector on first-boot (idempotent).
-- Required for the EmbeddingChunk.embedding vector column used by the scoped RAG chatbot.
CREATE EXTENSION IF NOT EXISTS vector;
