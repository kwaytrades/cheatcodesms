-- Add GIN indexes for faster JSONB queries on chunk_metadata
CREATE INDEX IF NOT EXISTS idx_knowledge_base_metadata_gin 
ON knowledge_base USING GIN (chunk_metadata);

CREATE INDEX IF NOT EXISTS idx_knowledge_base_metadata_chapter 
ON knowledge_base ((chunk_metadata->>'chapter_number'));

CREATE INDEX IF NOT EXISTS idx_knowledge_base_metadata_topics 
ON knowledge_base USING GIN ((chunk_metadata->'topics'));

-- Add index for faster category searches
CREATE INDEX IF NOT EXISTS idx_knowledge_base_category 
ON knowledge_base (category);