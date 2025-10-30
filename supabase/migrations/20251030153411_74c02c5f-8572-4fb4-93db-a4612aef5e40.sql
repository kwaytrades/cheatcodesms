-- Drop the problematic foreign key constraint that only allows product_agents
ALTER TABLE scheduled_messages 
DROP CONSTRAINT IF EXISTS scheduled_messages_agent_id_fkey;

-- Make agent_id nullable since not all messages require an agent
ALTER TABLE scheduled_messages 
ALTER COLUMN agent_id DROP NOT NULL;

-- Add comment explaining the change
COMMENT ON COLUMN scheduled_messages.agent_id IS 'References either product_agents.id or agent_conversations.id - validated at application level';