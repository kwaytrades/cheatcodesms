-- Create function to recalculate active agent considering both product_agents and agent_conversations
CREATE OR REPLACE FUNCTION public.recalculate_active_agent_unified(p_contact_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_help_mode_until TIMESTAMP WITH TIME ZONE;
  v_is_help_mode BOOLEAN;
  v_highest_priority_agent_id UUID;
  v_highest_priority INTEGER;
  v_agent_type TEXT;
BEGIN
  -- Check if contact is in help mode
  SELECT help_mode_until INTO v_help_mode_until
  FROM conversation_state
  WHERE contact_id = p_contact_id;
  
  v_is_help_mode := v_help_mode_until IS NOT NULL AND v_help_mode_until > NOW();
  
  -- Find the highest priority active agent from BOTH tables
  WITH all_agents AS (
    -- Product agents
    SELECT 
      pa.id,
      pa.product_type as agent_type,
      CASE 
        WHEN v_is_help_mode AND pa.product_type = 'customer_service' THEN 100
        WHEN pa.product_type = 'sales_agent' THEN 10
        WHEN pa.product_type = 'webinar' THEN 8
        WHEN pa.product_type = 'textbook' THEN 5
        WHEN pa.product_type IN ('flashcards', 'algo_monthly', 'ccta') THEN 4
        WHEN pa.product_type = 'lead_nurture' THEN 3
        WHEN pa.product_type = 'customer_service' THEN 2
        ELSE 1
      END AS priority
    FROM product_agents pa
    WHERE pa.contact_id = p_contact_id
      AND pa.status = 'active'
      AND pa.expiration_date > NOW()
    
    UNION ALL
    
    -- Agent conversations (sales campaigns)
    SELECT 
      ac.id,
      ac.agent_type,
      CASE 
        WHEN ac.agent_type = 'sales_agent' THEN 10
        WHEN ac.agent_type = 'webinar' THEN 8
        WHEN ac.agent_type = 'textbook' THEN 5
        WHEN ac.agent_type IN ('flashcards', 'algo_monthly', 'ccta') THEN 4
        WHEN ac.agent_type = 'lead_nurture' THEN 3
        WHEN ac.agent_type = 'customer_service' THEN 2
        ELSE 1
      END AS priority
    FROM agent_conversations ac
    WHERE ac.contact_id = p_contact_id
      AND ac.status = 'active'
      AND ac.expiration_date > NOW()
  )
  SELECT id, priority, agent_type
  INTO v_highest_priority_agent_id, v_highest_priority, v_agent_type
  FROM all_agents
  ORDER BY priority DESC, id DESC
  LIMIT 1;
  
  -- Update conversation_state with the highest priority agent
  IF v_highest_priority_agent_id IS NOT NULL THEN
    UPDATE conversation_state
    SET 
      active_agent_id = v_highest_priority_agent_id,
      agent_priority = v_highest_priority,
      updated_at = NOW()
    WHERE contact_id = p_contact_id;
    
    RAISE NOTICE 'Set active agent to % (type: %, priority: %)', v_highest_priority_agent_id, v_agent_type, v_highest_priority;
  END IF;
END;
$$;