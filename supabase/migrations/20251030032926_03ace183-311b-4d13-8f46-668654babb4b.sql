-- Remove the foreign key constraint that prevents agent_conversations from being active agents
ALTER TABLE conversation_state 
DROP CONSTRAINT IF EXISTS conversation_state_active_agent_id_fkey;

-- The active_agent_id column can now reference either product_agents OR agent_conversations
-- We don't add a new foreign key because UUID can point to either table