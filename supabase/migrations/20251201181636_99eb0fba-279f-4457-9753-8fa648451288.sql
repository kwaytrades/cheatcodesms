-- Fix get_or_create_agent_conversation to include workspace_id
CREATE OR REPLACE FUNCTION public.get_or_create_agent_conversation(p_contact_id uuid, p_agent_type text, p_agent_id uuid DEFAULT NULL::uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_conversation_id UUID;
  v_workspace_id UUID;
BEGIN
  -- Get workspace_id from contact
  SELECT workspace_id INTO v_workspace_id
  FROM contacts
  WHERE id = p_contact_id;
  
  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Contact workspace_id not found for contact_id: %', p_contact_id;
  END IF;
  
  -- Try to find existing active conversation
  SELECT id INTO v_conversation_id
  FROM agent_conversations
  WHERE contact_id = p_contact_id 
    AND agent_type = p_agent_type
    AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- If no existing conversation found, create new one
  IF v_conversation_id IS NULL THEN
    INSERT INTO agent_conversations (
      contact_id,
      agent_type,
      agent_id,
      status,
      started_at,
      workspace_id
    ) VALUES (
      p_contact_id,
      p_agent_type,
      p_agent_id,
      'active',
      NOW(),
      v_workspace_id
    )
    RETURNING id INTO v_conversation_id;
  END IF;
  
  RETURN v_conversation_id;
END;
$function$;