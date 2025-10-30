-- Enable pg_cron and pg_net extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule process-conversation-triggers to run every 15 minutes
SELECT cron.schedule(
  'process-conversation-triggers-every-15min',
  '*/15 * * * *',
  $$
  SELECT
    net.http_post(
      url:='https://kkzqhkrcjwktttsntooz.supabase.co/functions/v1/process-conversation-triggers',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrenFoa3JjandrdHR0c250b296Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4NDM2MjcsImV4cCI6MjA3NjQxOTYyN30.AqJxUXOeuCrjyMaB87UORyNT4tSjHuuEE5qyAVppTtI"}'::jsonb,
      body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);