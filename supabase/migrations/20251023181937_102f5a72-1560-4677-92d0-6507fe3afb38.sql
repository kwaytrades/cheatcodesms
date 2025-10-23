-- Add last_engagement_at tracking to product_agents if not exists
ALTER TABLE product_agents 
ADD COLUMN IF NOT EXISTS last_engagement_at timestamp with time zone;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_product_agents_last_engagement 
ON product_agents(last_engagement_at);

-- Function to auto-archive inactive agents (60 days, excluding customer_service)
CREATE OR REPLACE FUNCTION public.archive_inactive_agents()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE product_agents pa
  SET 
    status = 'archived',
    updated_at = NOW()
  WHERE pa.status = 'active'
    AND pa.product_type != 'customer_service'
    AND pa.messages_sent > 0
    AND (
      pa.last_engagement_at IS NULL 
      OR pa.last_engagement_at < NOW() - INTERVAL '60 days'
    );
END;
$$;

-- Update auto-assign customer service agent to use 100-year expiration (indefinite)
CREATE OR REPLACE FUNCTION public.auto_assign_customer_service_agent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_agent_id uuid;
BEGIN
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
  );
  
  RETURN NEW;
END;
$$;