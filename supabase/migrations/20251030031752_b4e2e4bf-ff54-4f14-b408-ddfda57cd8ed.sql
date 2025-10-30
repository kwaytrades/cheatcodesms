-- Phase 1: Add expiration_date to agent_conversations table
ALTER TABLE agent_conversations 
ADD COLUMN IF NOT EXISTS expiration_date TIMESTAMP WITH TIME ZONE;

-- Backfill existing agent conversations with expiration dates based on agent type
UPDATE agent_conversations
SET expiration_date = CASE 
  WHEN agent_type = 'customer_service' THEN NOW() + INTERVAL '100 years'
  WHEN agent_type = 'sales_agent' THEN NOW() + INTERVAL '90 days'
  WHEN agent_type = 'textbook' THEN NOW() + INTERVAL '90 days'
  WHEN agent_type = 'flashcards' THEN NOW() + INTERVAL '60 days'
  WHEN agent_type = 'webinar' THEN NOW() + INTERVAL '30 days'
  WHEN agent_type = 'algo_monthly' THEN NOW() + INTERVAL '90 days'
  WHEN agent_type = 'ccta' THEN NOW() + INTERVAL '90 days'
  WHEN agent_type = 'lead_nurture' THEN NOW() + INTERVAL '90 days'
  ELSE NOW() + INTERVAL '90 days'
END
WHERE expiration_date IS NULL;