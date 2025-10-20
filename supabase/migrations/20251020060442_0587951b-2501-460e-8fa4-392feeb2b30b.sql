-- Add customer_profile and ai_profile fields to contacts table
ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS customer_profile jsonb,
ADD COLUMN IF NOT EXISTS ai_profile jsonb;

-- Add comment to describe the fields
COMMENT ON COLUMN public.contacts.customer_profile IS 'Customer profile data imported from Monday CRM (income, interest_level, trading_preferences, etc.)';
COMMENT ON COLUMN public.contacts.ai_profile IS 'AI-gathered insights from conversations (complaints, interests, preferences, important_notes)';