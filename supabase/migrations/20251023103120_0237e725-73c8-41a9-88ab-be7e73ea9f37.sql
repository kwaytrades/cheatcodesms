-- =========================================
-- CONVERSATIONAL AI CRM - DATABASE SCHEMA (CORRECTED)
-- Phase 1: Foundation Tables
-- =========================================

-- 1. Create product_agents table
CREATE TABLE IF NOT EXISTS product_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  product_type TEXT NOT NULL CHECK (product_type IN ('webinar', 'textbook', 'flashcards', 'algo_monthly', 'ccta', 'lead_nurture')),
  product_id UUID,
  
  -- Agent lifecycle
  assigned_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expiration_date TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'converted', 'churned', 'paused')),
  
  -- Agent context (stores form responses, goals, challenges)
  agent_context JSONB NOT NULL DEFAULT '{}',
  
  -- Performance tracking
  messages_sent INTEGER DEFAULT 0,
  replies_received INTEGER DEFAULT 0,
  conversion_achieved BOOLEAN DEFAULT FALSE,
  conversion_date TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_agents_contact ON product_agents(contact_id);
CREATE INDEX IF NOT EXISTS idx_product_agents_status ON product_agents(status);
CREATE INDEX IF NOT EXISTS idx_product_agents_expiration ON product_agents(expiration_date);
CREATE INDEX IF NOT EXISTS idx_product_agents_product_type ON product_agents(product_type);

-- Enable RLS
ALTER TABLE product_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view agents"
  ON product_agents FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage agents"
  ON product_agents FOR ALL
  USING (auth.role() = 'authenticated');

-- 2. Create conversation_state table
CREATE TABLE IF NOT EXISTS conversation_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE UNIQUE,
  
  -- Conversation management
  last_message_sent_at TIMESTAMPTZ,
  messages_sent_today INTEGER DEFAULT 0,
  messages_sent_this_week INTEGER DEFAULT 0,
  last_engagement_at TIMESTAMPTZ,
  
  -- Waiting/cooldown states
  waiting_for_reply BOOLEAN DEFAULT FALSE,
  waiting_until TIMESTAMPTZ,
  
  -- Conversation context
  current_conversation_phase TEXT,
  last_topic TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversation_state_contact ON conversation_state(contact_id);
CREATE INDEX IF NOT EXISTS idx_conversation_state_waiting ON conversation_state(waiting_until);
CREATE INDEX IF NOT EXISTS idx_conversation_state_last_message ON conversation_state(last_message_sent_at);

-- Enable RLS
ALTER TABLE conversation_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view conversation state"
  ON conversation_state FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage conversation state"
  ON conversation_state FOR ALL
  USING (auth.role() = 'authenticated');

-- 3. Create scheduled_messages table
CREATE TABLE IF NOT EXISTS scheduled_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES product_agents(id) ON DELETE CASCADE,
  
  -- Message details
  message_type TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('sms', 'email')),
  
  -- Scheduling
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'cancelled', 'failed')),
  
  -- Content
  subject TEXT,
  message_body TEXT NOT NULL,
  personalization_data JSONB,
  
  -- Error tracking
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_contact ON scheduled_messages(contact_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_scheduled_for ON scheduled_messages(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_status ON scheduled_messages(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_agent ON scheduled_messages(agent_id);

-- Enable RLS
ALTER TABLE scheduled_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view scheduled messages"
  ON scheduled_messages FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage scheduled messages"
  ON scheduled_messages FOR ALL
  USING (auth.role() = 'authenticated');

-- 4. Create agent_performance_metrics table
CREATE TABLE IF NOT EXISTS agent_performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_type TEXT NOT NULL,
  
  -- Time period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  -- Engagement metrics
  customers_served INTEGER DEFAULT 0,
  messages_sent INTEGER DEFAULT 0,
  message_open_rate NUMERIC(5,2),
  reply_rate NUMERIC(5,2),
  avg_messages_per_customer NUMERIC(5,2),
  
  -- Conversion metrics
  conversions INTEGER DEFAULT 0,
  conversion_rate NUMERIC(5,2),
  avg_time_to_purchase_days NUMERIC(5,2),
  revenue_generated NUMERIC(10,2),
  
  -- Sentiment metrics
  positive_sentiment_rate NUMERIC(5,2),
  negative_sentiment_rate NUMERIC(5,2),
  neutral_sentiment_rate NUMERIC(5,2),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(agent_type, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_agent_metrics_type ON agent_performance_metrics(agent_type);
CREATE INDEX IF NOT EXISTS idx_agent_metrics_period ON agent_performance_metrics(period_start, period_end);

-- Enable RLS
ALTER TABLE agent_performance_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view agent metrics"
  ON agent_performance_metrics FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage metrics"
  ON agent_performance_metrics FOR ALL
  USING (auth.role() = 'authenticated');

-- 5. Update contacts table with new fields
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS personality_type TEXT CHECK (personality_type IN ('analytical', 'fast_decision_maker', 'relationship_builder', 'skeptic')),
ADD COLUMN IF NOT EXISTS form_responses JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS behavioral_tags TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS last_engagement_action TEXT,
ADD COLUMN IF NOT EXISTS last_engagement_date TIMESTAMPTZ;

-- 6. Update contact_activities table
ALTER TABLE contact_activities
ADD COLUMN IF NOT EXISTS score_impact INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS activity_metadata JSONB DEFAULT '{}';

-- 7. Create function to auto-expire agents
CREATE OR REPLACE FUNCTION expire_old_agents()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE product_agents
  SET status = 'expired',
      updated_at = NOW()
  WHERE status = 'active'
    AND expiration_date < NOW();
END;
$$;

-- 8. Create function to reset daily message counters
CREATE OR REPLACE FUNCTION reset_daily_message_counters()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE conversation_state
  SET messages_sent_today = 0,
      updated_at = NOW()
  WHERE messages_sent_today > 0;
END;
$$;

-- 9. Create function to reset weekly message counters
CREATE OR REPLACE FUNCTION reset_weekly_message_counters()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE conversation_state
  SET messages_sent_this_week = 0,
      updated_at = NOW()
  WHERE messages_sent_this_week > 0;
END;
$$;

-- 10. Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 11. Create triggers for updated_at
DROP TRIGGER IF EXISTS update_product_agents_updated_at ON product_agents;
CREATE TRIGGER update_product_agents_updated_at
  BEFORE UPDATE ON product_agents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_conversation_state_updated_at ON conversation_state;
CREATE TRIGGER update_conversation_state_updated_at
  BEFORE UPDATE ON conversation_state
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_scheduled_messages_updated_at ON scheduled_messages;
CREATE TRIGGER update_scheduled_messages_updated_at
  BEFORE UPDATE ON scheduled_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();