-- Phase 1: Cleanup ALL duplicate agents (not just Francis)
-- Keep the newest agent for each contact+product_type combination
WITH ranked_agents AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY contact_id, product_type 
      ORDER BY created_at DESC
    ) as rn
  FROM product_agents
  WHERE status = 'active'
)
DELETE FROM product_agents
WHERE id IN (
  SELECT id FROM ranked_agents WHERE rn > 1
);

-- Delete orphaned conversations with empty agent_type
DELETE FROM agent_conversations
WHERE agent_type IS NULL OR agent_type = '';

-- Phase 2: Now create the unique index (duplicates are gone)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_agent_per_contact
ON product_agents(contact_id, product_type)
WHERE status = 'active';

-- Phase 3: Create function to safely get or create agent conversation
CREATE OR REPLACE FUNCTION get_or_create_agent_conversation(
  p_contact_id UUID,
  p_agent_type TEXT,
  p_agent_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversation_id UUID;
BEGIN
  SELECT id INTO v_conversation_id
  FROM agent_conversations
  WHERE contact_id = p_contact_id 
    AND agent_type = p_agent_type
    AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_conversation_id IS NULL THEN
    INSERT INTO agent_conversations (
      contact_id,
      agent_type,
      agent_id,
      status,
      started_at
    ) VALUES (
      p_contact_id,
      p_agent_type,
      p_agent_id,
      'active',
      NOW()
    )
    RETURNING id INTO v_conversation_id;
  END IF;
  
  RETURN v_conversation_id;
END;
$$;

-- Phase 4: Fix auto_assign trigger to prevent duplicates
CREATE OR REPLACE FUNCTION auto_assign_customer_service_agent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agent_id uuid;
  v_existing_agent_count integer;
BEGIN
  SELECT COUNT(*) INTO v_existing_agent_count
  FROM product_agents
  WHERE contact_id = NEW.id
    AND product_type = 'customer_service'
    AND status = 'active';
  
  IF v_existing_agent_count = 0 THEN
    INSERT INTO product_agents (
      contact_id,
      product_type,
      direction,
      status,
      expiration_date,
      agent_context,
      last_engagement_at
    ) VALUES (
      NEW.id,
      'customer_service',
      'inbound',
      'active',
      NOW() + INTERVAL '100 years',
      jsonb_build_object(
        'auto_assigned', true,
        'assigned_reason', 'Default customer service agent'
      ),
      NOW()
    )
    RETURNING id INTO v_agent_id;
    
    INSERT INTO conversation_state (
      contact_id,
      active_agent_id,
      agent_priority,
      current_conversation_phase,
      last_engagement_at
    ) VALUES (
      NEW.id,
      v_agent_id,
      10,
      'initial_contact',
      NOW()
    )
    ON CONFLICT (contact_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;