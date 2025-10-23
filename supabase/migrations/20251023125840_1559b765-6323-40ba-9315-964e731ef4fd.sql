-- Phase 1: Knowledge Base Chunking Support
ALTER TABLE knowledge_base 
  ADD COLUMN IF NOT EXISTS chunk_index INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS parent_document_id UUID REFERENCES knowledge_base(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS chunk_metadata JSONB DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_knowledge_base_parent ON knowledge_base(parent_document_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_agent_category ON knowledge_base(category) WHERE category LIKE 'agent_%';

-- Phase 2: Agent Test Results Table
CREATE TABLE IF NOT EXISTS agent_test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_type TEXT NOT NULL,
  test_scenario JSONB NOT NULL,
  messages JSONB NOT NULL,
  accuracy_score NUMERIC,
  knowledge_chunks_used JSONB,
  tester_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE agent_test_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage test results"
  ON agent_test_results FOR ALL
  USING (auth.role() = 'authenticated');

-- Phase 3: Add Sales & Customer Service Agent Types
ALTER TABLE product_agents 
  DROP CONSTRAINT IF EXISTS product_agents_product_type_check;

ALTER TABLE product_agents 
  ADD CONSTRAINT product_agents_product_type_check 
  CHECK (product_type IN (
    'webinar', 'textbook', 'flashcards', 'algo_monthly', 'ccta', 'lead_nurture',
    'sales_agent', 'customer_service'
  ));

ALTER TABLE product_agents 
  ADD COLUMN IF NOT EXISTS direction TEXT CHECK (direction IN ('inbound', 'outbound')) DEFAULT 'outbound';

-- Phase 4: Agent Conflict Prevention
ALTER TABLE conversation_state 
  ADD COLUMN IF NOT EXISTS active_agent_id UUID REFERENCES product_agents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS agent_priority INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS agent_queue JSONB DEFAULT '[]';

CREATE INDEX IF NOT EXISTS idx_conversation_state_active_agent ON conversation_state(active_agent_id);