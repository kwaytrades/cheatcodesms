-- Agent System Rebuild Migration (Fixed v2)
-- Creates agent-centric conversation architecture with RAG memory

-- Enable vector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Agent Conversations Table (one per agent type per contact)
CREATE TABLE IF NOT EXISTS agent_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  agent_type TEXT NOT NULL,
  agent_id UUID REFERENCES product_agents(id) ON DELETE SET NULL,
  
  -- Conversation metadata
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'archived')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  message_count INT DEFAULT 0,
  
  -- Context tracking
  conversation_summary TEXT,
  discussed_topics JSONB DEFAULT '[]'::jsonb,
  key_entities JSONB DEFAULT '{}'::jsonb,
  
  -- Memory management
  last_knowledge_refresh TIMESTAMPTZ,
  relevant_kb_chunks UUID[],
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(contact_id, agent_type)
);

CREATE INDEX idx_agent_conversations_contact_agent ON agent_conversations(contact_id, agent_type);
CREATE INDEX idx_agent_conversations_status ON agent_conversations(status);
CREATE INDEX idx_agent_conversations_last_message ON agent_conversations(last_message_at DESC);

-- Enable RLS
ALTER TABLE agent_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage agent conversations"
  ON agent_conversations FOR ALL
  USING (auth.role() = 'authenticated');

-- 2. Agent Messages Table (with vector embeddings for RAG)
CREATE TABLE IF NOT EXISTS agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES agent_conversations(id) ON DELETE CASCADE,
  
  -- Message content
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  
  -- Metadata
  token_count INT,
  model_used TEXT,
  latency_ms INT,
  
  -- Embeddings for semantic search
  embedding VECTOR(1536),
  
  -- Context used
  knowledge_chunks_used UUID[],
  customer_context JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_messages_conversation ON agent_messages(conversation_id, created_at DESC);
CREATE INDEX idx_agent_messages_role ON agent_messages(conversation_id, role);

-- Vector similarity search index
CREATE INDEX idx_agent_messages_embedding ON agent_messages 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Enable RLS
ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage agent messages"
  ON agent_messages FOR ALL
  USING (auth.role() = 'authenticated');

-- 3. Agent Memory Snapshots (compressed summaries for long conversations)
CREATE TABLE IF NOT EXISTS agent_memory_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES agent_conversations(id) ON DELETE CASCADE,
  
  -- Snapshot metadata
  snapshot_at TIMESTAMPTZ DEFAULT NOW(),
  messages_covered INT,
  
  -- Compressed memory
  summary TEXT NOT NULL,
  key_insights JSONB,
  
  -- Embeddings for semantic retrieval
  embedding VECTOR(1536),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_memory_snapshots_conversation ON agent_memory_snapshots(conversation_id, snapshot_at DESC);
CREATE INDEX idx_memory_snapshots_embedding ON agent_memory_snapshots 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Enable RLS
ALTER TABLE agent_memory_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage memory snapshots"
  ON agent_memory_snapshots FOR ALL
  USING (auth.role() = 'authenticated');

-- 4. Update product_agents to link to conversations
ALTER TABLE product_agents 
ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES agent_conversations(id);

CREATE INDEX IF NOT EXISTS idx_product_agents_conversation ON product_agents(conversation_id);

-- 5. Function to search agent messages by semantic similarity
CREATE OR REPLACE FUNCTION search_agent_memories(
  p_conversation_id UUID,
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5
)
RETURNS TABLE(
  id UUID,
  role TEXT,
  content TEXT,
  similarity FLOAT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    am.id,
    am.role,
    am.content,
    (1 - (am.embedding <=> query_embedding))::FLOAT AS similarity,
    am.created_at
  FROM agent_messages am
  WHERE 
    am.conversation_id = p_conversation_id
    AND am.embedding IS NOT NULL
    AND (1 - (am.embedding <=> query_embedding)) > match_threshold
  ORDER BY am.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 6. Function to update conversation metadata
CREATE OR REPLACE FUNCTION update_agent_conversation_metadata()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE agent_conversations
  SET 
    last_message_at = NOW(),
    message_count = message_count + 1,
    updated_at = NOW()
  WHERE id = NEW.conversation_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_conversation_on_message
  AFTER INSERT ON agent_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_conversation_metadata();

-- 7. Migrate existing data from conversations/messages to new structure
-- Create agent_conversations for existing contacts with conversations (no agent_id initially)
INSERT INTO agent_conversations (contact_id, agent_type, started_at, last_message_at, status)
SELECT DISTINCT
  c.contact_id,
  COALESCE(c.assigned_agent::text, 'customer_service'),
  c.created_at,
  c.last_message_at,
  CASE 
    WHEN c.status::text = 'active' THEN 'active'
    WHEN c.status::text = 'archived' THEN 'archived'
    ELSE 'completed'
  END
FROM conversations c
WHERE c.contact_id IS NOT NULL
ON CONFLICT (contact_id, agent_type) DO NOTHING;

-- Migrate messages to agent_messages (link to agent_conversations)
INSERT INTO agent_messages (conversation_id, role, content, created_at)
SELECT 
  ac.id,
  CASE 
    WHEN m.sender::text = 'customer' THEN 'user'
    WHEN m.sender::text = 'ai' THEN 'assistant'
    ELSE 'system'
  END,
  m.body,
  m.created_at
FROM messages m
JOIN conversations c ON m.conversation_id = c.id
JOIN agent_conversations ac ON ac.contact_id = c.contact_id
WHERE c.contact_id IS NOT NULL
ORDER BY m.created_at;

-- Update product_agents with conversation_id links
UPDATE product_agents pa
SET conversation_id = ac.id
FROM agent_conversations ac
WHERE pa.contact_id = ac.contact_id
  AND pa.product_type = ac.agent_type;