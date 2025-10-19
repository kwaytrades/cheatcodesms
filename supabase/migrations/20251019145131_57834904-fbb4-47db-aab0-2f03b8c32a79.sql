-- Add error_message column to campaign_messages table
ALTER TABLE public.campaign_messages 
ADD COLUMN IF NOT EXISTS error_message TEXT;