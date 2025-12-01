-- Fix auto_assign_customer_service_agent to include workspace_id
CREATE OR REPLACE FUNCTION public.auto_assign_customer_service_agent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
      last_engagement_at,
      workspace_id
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
      NOW(),
      NEW.workspace_id
    )
    RETURNING id INTO v_agent_id;
    
    INSERT INTO conversation_state (
      contact_id,
      active_agent_id,
      agent_priority,
      current_conversation_phase,
      last_engagement_at,
      workspace_id
    ) VALUES (
      NEW.id,
      v_agent_id,
      10,
      'initial_contact',
      NOW(),
      NEW.workspace_id
    )
    ON CONFLICT (contact_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$function$;