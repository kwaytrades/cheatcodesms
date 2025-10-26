-- Enable pg_cron extension for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule hourly score recalculation for active contacts
-- Runs every hour at :00 minutes
SELECT cron.schedule(
  'recalculate-active-contact-scores',
  '0 * * * *',
  $$
  SELECT
    net.http_post(
      url:='https://kkzqhkrcjwktttsntooz.supabase.co/functions/v1/recalculate-all-scores',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb,
      body:='{"limit": 5000}'::jsonb
    ) as request_id;
  $$
);