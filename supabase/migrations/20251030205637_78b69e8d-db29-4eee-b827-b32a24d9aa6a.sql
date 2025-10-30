-- Create function to automatically mark campaign contacts as responded
CREATE OR REPLACE FUNCTION mark_campaign_contact_responded()
RETURNS TRIGGER AS $$
DECLARE
  v_contact_id UUID;
  v_campaign_contact_id UUID;
  v_campaign_id UUID;
  v_campaign_start_date TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Only process inbound messages
  IF NEW.direction != 'inbound' THEN
    RETURN NEW;
  END IF;
  
  -- Get contact_id from conversation
  SELECT contact_id INTO v_contact_id
  FROM conversations
  WHERE id = NEW.conversation_id;
  
  IF v_contact_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Find active/pending campaign for this contact
  SELECT acc.id, acc.campaign_id, camp.start_date
  INTO v_campaign_contact_id, v_campaign_id, v_campaign_start_date
  FROM ai_sales_campaign_contacts acc
  JOIN ai_sales_campaigns camp ON camp.id = acc.campaign_id
  WHERE acc.contact_id = v_contact_id
    AND acc.status IN ('active', 'pending')
    AND acc.responded = false
  LIMIT 1;
  
  IF v_campaign_contact_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Check if message was sent after campaign started
  IF v_campaign_start_date IS NOT NULL AND NEW.created_at >= v_campaign_start_date THEN
    -- Mark as responded
    UPDATE ai_sales_campaign_contacts
    SET responded = true, updated_at = NOW()
    WHERE id = v_campaign_contact_id;
    
    -- Increment campaign response count
    UPDATE ai_sales_campaigns
    SET responses_received = COALESCE(responses_received, 0) + 1,
        updated_at = NOW()
    WHERE id = v_campaign_id;
    
    RAISE NOTICE 'Marked campaign contact % as responded for campaign %', v_campaign_contact_id, v_campaign_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on messages table
DROP TRIGGER IF EXISTS trigger_mark_campaign_responded ON messages;
CREATE TRIGGER trigger_mark_campaign_responded
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION mark_campaign_contact_responded();