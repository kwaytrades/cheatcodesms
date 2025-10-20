-- Add new fields to contacts table for dynamic lead scoring
ALTER TABLE public.contacts
ADD COLUMN IF NOT EXISTS last_score_update timestamp with time zone DEFAULT now(),
ADD COLUMN IF NOT EXISTS score_trend text DEFAULT 'stable',
ADD COLUMN IF NOT EXISTS engagement_velocity numeric DEFAULT 0;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_contacts_lead_score ON public.contacts(lead_score);
CREATE INDEX IF NOT EXISTS idx_contacts_lead_status ON public.contacts(lead_status);

-- Add comments for documentation
COMMENT ON COLUMN public.contacts.last_score_update IS 'Timestamp of last lead score calculation';
COMMENT ON COLUMN public.contacts.score_trend IS 'Trend of score changes: up, down, stable';
COMMENT ON COLUMN public.contacts.engagement_velocity IS 'Rate of engagement increase (points per day)';