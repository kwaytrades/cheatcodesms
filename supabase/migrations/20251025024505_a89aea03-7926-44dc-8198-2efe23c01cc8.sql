-- Clean up empty conversations created by previous migration
DELETE FROM conversations
WHERE id IN (
  SELECT c.id 
  FROM conversations c
  LEFT JOIN messages m ON m.conversation_id = c.id
  WHERE m.id IS NULL
    AND c.created_at > NOW() - INTERVAL '10 minutes'
    AND c.last_message_at = c.created_at
);

-- Reset conversation_state for contacts that lost their conversations
UPDATE conversation_state cs
SET 
  active_agent_id = NULL,
  agent_priority = 0,
  last_engagement_at = NULL
WHERE NOT EXISTS (
  SELECT 1 FROM conversations conv WHERE conv.contact_id = cs.contact_id
);

-- Backfill: Create message records for successfully sent scheduled_messages
INSERT INTO messages (
  conversation_id,
  sender,
  direction,
  body,
  status,
  created_at
)
SELECT 
  conv.id as conversation_id,
  'ai_sales'::message_sender as sender,
  'outbound'::message_direction as direction,
  sm.message_body as body,
  'sent'::message_status as status,
  sm.sent_at as created_at
FROM scheduled_messages sm
INNER JOIN conversations conv ON conv.contact_id = sm.contact_id
WHERE sm.status = 'sent'
  AND sm.channel = 'sms'
  AND sm.sent_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM messages m 
    WHERE m.conversation_id = conv.id 
      AND m.body = sm.message_body
      AND m.created_at BETWEEN sm.sent_at - INTERVAL '5 seconds' 
                           AND sm.sent_at + INTERVAL '5 seconds'
  )
ORDER BY sm.sent_at ASC;

-- Update conversations.last_message_at to match latest message
UPDATE conversations c
SET last_message_at = (
  SELECT MAX(created_at) 
  FROM messages m 
  WHERE m.conversation_id = c.id
)
WHERE EXISTS (
  SELECT 1 FROM messages m WHERE m.conversation_id = c.id
);