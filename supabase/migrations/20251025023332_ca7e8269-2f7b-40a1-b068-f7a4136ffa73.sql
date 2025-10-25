-- Create conversations for contacts with active agents but no conversation record
INSERT INTO conversations (
  contact_id,
  phone_number,
  contact_name,
  assigned_agent,
  status,
  last_message_at
)
SELECT DISTINCT
  c.id,
  COALESCE(c.phone_number, 'NO_PHONE'),
  c.full_name,
  'cs_ai'::agent_type, 
  'active'::conversation_status,
  NOW()
FROM contacts c
INNER JOIN product_agents pa ON pa.contact_id = c.id
WHERE pa.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM conversations conv WHERE conv.contact_id = c.id
  );

-- Update conversation_state with correct priorities (normal mode only)
UPDATE conversation_state cs
SET 
  active_agent_id = pa.id,
  agent_priority = CASE pa.product_type
    WHEN 'sales_agent' THEN 10
    WHEN 'webinar' THEN 6
    WHEN 'textbook' THEN 5
    WHEN 'flashcards' THEN 4
    WHEN 'algo_monthly' THEN 4
    WHEN 'ccta' THEN 4
    WHEN 'lead_nurture' THEN 3
    WHEN 'customer_service' THEN 2
    ELSE 1
  END,
  last_engagement_at = NOW(),
  updated_at = NOW()
FROM product_agents pa
WHERE cs.contact_id = pa.contact_id
  AND pa.status = 'active'
  AND cs.active_agent_id IS NULL
  AND cs.help_mode_until IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM product_agents pa2
    WHERE pa2.contact_id = pa.contact_id
      AND pa2.status = 'active'
      AND pa2.id != pa.id
      AND CASE pa2.product_type
        WHEN 'sales_agent' THEN 10
        WHEN 'webinar' THEN 6
        WHEN 'textbook' THEN 5
        WHEN 'flashcards' THEN 4
        WHEN 'algo_monthly' THEN 4
        WHEN 'ccta' THEN 4
        WHEN 'lead_nurture' THEN 3
        WHEN 'customer_service' THEN 2
        ELSE 1
      END > CASE pa.product_type
        WHEN 'sales_agent' THEN 10
        WHEN 'webinar' THEN 6
        WHEN 'textbook' THEN 5
        WHEN 'flashcards' THEN 4
        WHEN 'algo_monthly' THEN 4
        WHEN 'ccta' THEN 4
        WHEN 'lead_nurture' THEN 3
        WHEN 'customer_service' THEN 2
        ELSE 1
      END
  );