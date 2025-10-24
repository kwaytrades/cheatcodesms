-- Add campaign configuration to agent_type_configs
ALTER TABLE agent_type_configs
ADD COLUMN IF NOT EXISTS campaign_config JSONB DEFAULT '{
  "duration_days": 90,
  "outreach_schedule": [],
  "milestone_triggers": [],
  "frequency_limits": {
    "max_per_day": 2,
    "max_per_week": 5,
    "min_hours_between": 12
  }
}'::JSONB;

-- Create agent_campaign_events table to track campaign progress
CREATE TABLE IF NOT EXISTS agent_campaign_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES product_agents(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id),
  event_type TEXT NOT NULL,
  trigger_day INTEGER,
  trigger_config JSONB,
  message_scheduled BOOLEAN DEFAULT false,
  message_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add campaign context fields to scheduled_messages
ALTER TABLE scheduled_messages
ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES product_agents(id),
ADD COLUMN IF NOT EXISTS campaign_day INTEGER,
ADD COLUMN IF NOT EXISTS trigger_type TEXT;

-- Enable RLS on agent_campaign_events
ALTER TABLE agent_campaign_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage campaign events"
ON agent_campaign_events
FOR ALL
USING (auth.role() = 'authenticated');

-- Seed default campaign configs for each agent type
UPDATE agent_type_configs SET campaign_config = '{
  "duration_days": 90,
  "outreach_schedule": [
    {"day": 1, "type": "welcome", "goal": "engage", "channel": "sms"},
    {"day": 3, "type": "lesson_check", "goal": "educate", "channel": "sms"},
    {"day": 7, "type": "progress_review", "goal": "educate", "channel": "email"},
    {"day": 14, "type": "halfway_chapter", "goal": "engage", "channel": "sms"},
    {"day": 30, "type": "month_milestone", "goal": "encourage", "channel": "email"},
    {"day": 60, "type": "masterclass_intro", "goal": "soft_sell", "channel": "email"},
    {"day": 85, "type": "1on1_offer", "goal": "upsell", "channel": "email"}
  ],
  "milestone_triggers": [
    {"event": "lesson_completed", "threshold": 3, "type": "encouragement", "goal": "engage", "channel": "sms"},
    {"event": "no_activity", "days": 7, "type": "re_engagement", "goal": "activate", "channel": "sms"}
  ],
  "frequency_limits": {
    "max_per_day": 2,
    "max_per_week": 5,
    "min_hours_between": 12
  }
}'::JSONB
WHERE agent_type = 'textbook';

UPDATE agent_type_configs SET campaign_config = '{
  "duration_days": 60,
  "outreach_schedule": [
    {"day": 1, "type": "welcome", "goal": "engage", "channel": "sms"},
    {"day": 3, "type": "setup_check", "goal": "support", "channel": "sms"},
    {"day": 7, "type": "usage_check", "goal": "engage", "channel": "sms"},
    {"day": 14, "type": "tips_tricks", "goal": "educate", "channel": "email"},
    {"day": 30, "type": "mid_subscription", "goal": "retain", "channel": "email"},
    {"day": 50, "type": "renewal_prep", "goal": "retain", "channel": "sms"},
    {"day": 55, "type": "renewal_reminder", "goal": "upsell", "channel": "email"}
  ],
  "milestone_triggers": [
    {"event": "no_login", "days": 7, "type": "churn_prevention", "goal": "activate", "channel": "sms"},
    {"event": "high_usage", "threshold": 5, "type": "success_check", "goal": "retain", "channel": "sms"}
  ],
  "frequency_limits": {
    "max_per_day": 2,
    "max_per_week": 4,
    "min_hours_between": 12
  }
}'::JSONB
WHERE agent_type = 'algo_monthly';

UPDATE agent_type_configs SET campaign_config = '{
  "duration_days": 30,
  "outreach_schedule": [
    {"day": 1, "type": "welcome", "goal": "engage", "channel": "sms"},
    {"day": 3, "type": "initial_check", "goal": "support", "channel": "sms"},
    {"day": 7, "type": "first_week", "goal": "educate", "channel": "email"},
    {"day": 14, "type": "halfway", "goal": "engage", "channel": "sms"},
    {"day": 21, "type": "final_week", "goal": "retain", "channel": "sms"},
    {"day": 28, "type": "completion", "goal": "upsell", "channel": "email"}
  ],
  "milestone_triggers": [
    {"event": "no_engagement", "days": 5, "type": "re_engage", "goal": "activate", "channel": "sms"}
  ],
  "frequency_limits": {
    "max_per_day": 2,
    "max_per_week": 5,
    "min_hours_between": 12
  }
}'::JSONB
WHERE agent_type IN ('sales_agent', 'lead_nurture', 'customer_service');