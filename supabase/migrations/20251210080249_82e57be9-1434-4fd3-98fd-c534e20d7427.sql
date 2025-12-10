-- Update the validation trigger to allow all agent types (textbook, flashcards, etc.)
-- These are needed for testing and the agent chat system
CREATE OR REPLACE FUNCTION public.validate_agent_conversation_type()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Allow all valid agent types for agent_conversations
  -- This includes product agents for testing purposes
  IF NEW.agent_type NOT IN (
    'sales_agent', 
    'customer_service', 
    'textbook', 
    'flashcards', 
    'algo_monthly', 
    'ccta', 
    'webinar', 
    'lead_nurture',
    'trade_analysis'
  ) THEN
    RAISE EXCEPTION 'Invalid agent_type for agent_conversations: %. Valid types are: sales_agent, customer_service, textbook, flashcards, algo_monthly, ccta, webinar, lead_nurture, trade_analysis', NEW.agent_type;
  END IF;
  
  RETURN NEW;
END;
$function$;