-- Add validation to prevent product agent types in agent_conversations
-- Only sales_agent and customer_service should exist in this table
-- Product agents (textbook, webinar, flashcards, etc.) belong in product_agents table

-- Create a validation trigger function
CREATE OR REPLACE FUNCTION validate_agent_conversation_type()
RETURNS TRIGGER AS $$
BEGIN
  -- Only allow sales_agent and customer_service in agent_conversations
  IF NEW.agent_type NOT IN ('sales_agent', 'customer_service') THEN
    RAISE EXCEPTION 'Invalid agent_type for agent_conversations: %. Only sales_agent and customer_service are allowed. Product agents should use the product_agents table.', NEW.agent_type;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate on insert and update
DROP TRIGGER IF EXISTS validate_agent_type_trigger ON agent_conversations;
CREATE TRIGGER validate_agent_type_trigger
  BEFORE INSERT OR UPDATE OF agent_type ON agent_conversations
  FOR EACH ROW
  EXECUTE FUNCTION validate_agent_conversation_type();

-- Add a comment to the table for documentation
COMMENT ON TABLE agent_conversations IS 'Stores active AI agent conversations. Only sales_agent and customer_service types allowed. Product agents use product_agents table.';