-- Fix security warnings: Add search_path to functions

-- Update search_agent_memories function with secure search_path
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
STABLE
SECURITY DEFINER
SET search_path = public
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

-- Update conversation metadata function with secure search_path
CREATE OR REPLACE FUNCTION update_agent_conversation_metadata()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE agent_conversations
  SET 
    last_message_at = NOW(),
    message_count = message_count + 1,
    updated_at = NOW()
  WHERE id = NEW.conversation_id;
  
  RETURN NEW;
END;
$$;