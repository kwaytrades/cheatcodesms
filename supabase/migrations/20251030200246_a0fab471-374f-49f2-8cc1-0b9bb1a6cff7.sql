-- Function to increment campaign message counter when messages are sent
CREATE OR REPLACE FUNCTION increment_campaign_message_counter()
RETURNS TRIGGER AS $$
BEGIN
  -- When a scheduled message is marked as sent
  IF NEW.status = 'sent' AND (OLD.status IS NULL OR OLD.status != 'sent') THEN
    -- Increment campaign messages_sent counter
    UPDATE ai_sales_campaigns
    SET 
      messages_sent = COALESCE(messages_sent, 0) + 1,
      updated_at = NOW()
    WHERE id IN (
      SELECT campaign_id 
      FROM ai_sales_campaign_contacts 
      WHERE contact_id = NEW.contact_id
      AND status IN ('active', 'pending')
    );
    
    -- Increment campaign contact messages_received counter
    UPDATE ai_sales_campaign_contacts
    SET 
      messages_received = COALESCE(messages_received, 0) + 1,
      last_outreach_at = NOW(),
      updated_at = NOW()
    WHERE contact_id = NEW.contact_id
    AND campaign_id IN (
      SELECT campaign_id 
      FROM ai_sales_campaign_contacts 
      WHERE contact_id = NEW.contact_id
      AND status IN ('active', 'pending')
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for scheduled messages
CREATE TRIGGER update_campaign_message_counter
AFTER UPDATE ON scheduled_messages
FOR EACH ROW
EXECUTE FUNCTION increment_campaign_message_counter();

-- Function to track campaign responses when contacts reply
CREATE OR REPLACE FUNCTION increment_campaign_response_counter()
RETURNS TRIGGER AS $$
BEGIN
  -- When a contact sends a message (not system/agent)
  IF NEW.direction = 'inbound' THEN
    -- Increment campaign responses_received counter
    UPDATE ai_sales_campaigns
    SET 
      responses_received = COALESCE(responses_received, 0) + 1,
      updated_at = NOW()
    WHERE id IN (
      SELECT campaign_id 
      FROM ai_sales_campaign_contacts 
      WHERE contact_id = NEW.contact_id
      AND status IN ('active', 'pending')
    );
    
    -- Mark campaign contact as responded
    UPDATE ai_sales_campaign_contacts
    SET 
      responded = true,
      status = 'active',
      updated_at = NOW()
    WHERE contact_id = NEW.contact_id
    AND responded = false
    AND campaign_id IN (
      SELECT campaign_id 
      FROM ai_sales_campaign_contacts 
      WHERE contact_id = NEW.contact_id
      AND status IN ('active', 'pending')
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for messages table to track responses
CREATE TRIGGER update_campaign_response_counter
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION increment_campaign_response_counter();