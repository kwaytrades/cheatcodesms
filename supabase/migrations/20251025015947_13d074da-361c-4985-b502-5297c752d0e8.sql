-- Add help_mode_until column to conversation_state for 24hr help override tracking
ALTER TABLE conversation_state 
ADD COLUMN IF NOT EXISTS help_mode_until timestamp with time zone;

-- Fix conversation_state for contact #1370 (set textbook agent as active)
UPDATE conversation_state
SET 
  active_agent_id = '89f6f528-ef4f-4cda-83f6-2cd930675cbb',
  agent_priority = 5,
  help_mode_until = NULL,
  last_engagement_at = NOW()
WHERE contact_id = 'e1daabfd-5a02-4cca-a108-6de63af10a4f';