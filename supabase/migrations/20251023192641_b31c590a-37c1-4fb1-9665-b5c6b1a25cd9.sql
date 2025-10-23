-- Add indexes for knowledge base search (simplified version)

-- Create an index on category for efficient filtering by agent type
CREATE INDEX IF NOT EXISTS knowledge_base_category_idx 
ON knowledge_base (category);

-- Create an index on parent_document_id for efficient chunk queries
CREATE INDEX IF NOT EXISTS knowledge_base_parent_document_idx 
ON knowledge_base (parent_document_id);