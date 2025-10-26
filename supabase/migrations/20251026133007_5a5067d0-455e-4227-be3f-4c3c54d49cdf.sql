-- Create function to recalculate and set the highest priority active agent
CREATE OR REPLACE FUNCTION public.recalculate_active_agent(p_contact_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_help_mode_until TIMESTAMP WITH TIME ZONE;
  v_is_help_mode BOOLEAN;
  v_highest_priority_agent_id UUID;
  v_highest_priority INTEGER;
BEGIN
  -- Check if contact is in help mode
  SELECT help_mode_until INTO v_help_mode_until
  FROM conversation_state
  WHERE contact_id = p_contact_id;
  
  v_is_help_mode := v_help_mode_until IS NOT NULL AND v_help_mode_until > NOW();
  
  -- Find the highest priority active agent
  -- If in help mode, customer_service gets priority 10
  -- Otherwise, use normal priorities: sales_agent=10, webinar=8, textbook=5, etc.
  SELECT 
    pa.id,
    CASE 
      WHEN v_is_help_mode AND pa.product_type = 'customer_service' THEN 10
      WHEN pa.product_type = 'sales_agent' THEN 10
      WHEN pa.product_type = 'webinar' THEN 8
      WHEN pa.product_type = 'textbook' THEN 5
      WHEN pa.product_type IN ('flashcards', 'algo_monthly', 'ccta') THEN 4
      WHEN pa.product_type = 'lead_nurture' THEN 3
      WHEN pa.product_type = 'customer_service' THEN 2
      ELSE 1
    END AS priority
  INTO v_highest_priority_agent_id, v_highest_priority
  FROM product_agents pa
  WHERE pa.contact_id = p_contact_id
    AND pa.status = 'active'
    AND pa.expiration_date > NOW()
  ORDER BY 
    CASE 
      WHEN v_is_help_mode AND pa.product_type = 'customer_service' THEN 10
      WHEN pa.product_type = 'sales_agent' THEN 10
      WHEN pa.product_type = 'webinar' THEN 8
      WHEN pa.product_type = 'textbook' THEN 5
      WHEN pa.product_type IN ('flashcards', 'algo_monthly', 'ccta') THEN 4
      WHEN pa.product_type = 'lead_nurture' THEN 3
      WHEN pa.product_type = 'customer_service' THEN 2
      ELSE 1
    END DESC
  LIMIT 1;
  
  -- Update conversation_state with the highest priority agent
  IF v_highest_priority_agent_id IS NOT NULL THEN
    UPDATE conversation_state
    SET 
      active_agent_id = v_highest_priority_agent_id,
      agent_priority = v_highest_priority,
      updated_at = NOW()
    WHERE contact_id = p_contact_id;
  END IF;
END;
$$;