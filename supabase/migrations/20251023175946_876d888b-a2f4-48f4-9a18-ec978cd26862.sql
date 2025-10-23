-- Create function to auto-assign customer service agent to new contacts
CREATE OR REPLACE FUNCTION public.auto_assign_customer_service_agent()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agent_id uuid;
BEGIN
  -- Insert customer service agent for new contact
  INSERT INTO product_agents (
    contact_id,
    product_type,
    direction,
    status,
    expiration_date,
    agent_context
  ) VALUES (
    NEW.id,
    'customer_service',
    'inbound',
    'active',
    NOW() + INTERVAL '365 days',
    jsonb_build_object(
      'auto_assigned', true,
      'assigned_reason', 'Default customer service agent'
    )
  )
  RETURNING id INTO v_agent_id;
  
  -- Initialize conversation state with customer service agent as active
  INSERT INTO conversation_state (
    contact_id,
    active_agent_id,
    agent_priority,
    current_conversation_phase
  ) VALUES (
    NEW.id,
    v_agent_id,
    10,
    'initial_contact'
  );
  
  RETURN NEW;
END;
$$;

-- Create trigger to auto-assign customer service agent on contact creation
CREATE TRIGGER assign_customer_service_on_contact_creation
AFTER INSERT ON contacts
FOR EACH ROW
EXECUTE FUNCTION public.auto_assign_customer_service_agent();

-- Backfill existing contacts without any agents
DO $$
DECLARE
  v_contact_record RECORD;
  v_agent_id uuid;
BEGIN
  FOR v_contact_record IN 
    SELECT c.id
    FROM contacts c
    WHERE NOT EXISTS (
      SELECT 1 FROM product_agents pa 
      WHERE pa.contact_id = c.id
    )
  LOOP
    -- Insert customer service agent
    INSERT INTO product_agents (
      contact_id,
      product_type,
      direction,
      status,
      expiration_date,
      agent_context
    ) VALUES (
      v_contact_record.id,
      'customer_service',
      'inbound',
      'active',
      NOW() + INTERVAL '365 days',
      jsonb_build_object(
        'auto_assigned', true,
        'backfill', true,
        'assigned_date', NOW()
      )
    )
    RETURNING id INTO v_agent_id;
    
    -- Initialize conversation state if not exists
    INSERT INTO conversation_state (
      contact_id,
      active_agent_id,
      agent_priority,
      current_conversation_phase
    )
    VALUES (
      v_contact_record.id,
      v_agent_id,
      10,
      'initial_contact'
    )
    ON CONFLICT (contact_id) DO NOTHING;
  END LOOP;
END $$;