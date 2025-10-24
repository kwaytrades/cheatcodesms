-- Create subscription tiers table
CREATE TABLE subscription_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price_monthly NUMERIC NOT NULL,
  credits_per_month INTEGER, -- NULL for unlimited
  stripe_price_id TEXT,
  watchlist_slots INTEGER DEFAULT 5,
  features JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create user subscriptions table
CREATE TABLE user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  tier_id UUID REFERENCES subscription_tiers(id),
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  status TEXT DEFAULT 'trial' CHECK (status IN ('trial', 'active', 'cancelled', 'past_due')),
  credits_remaining INTEGER DEFAULT 10,
  credits_reset_date DATE,
  trial_used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(contact_id)
);

-- Create stock analyses table
CREATE TABLE stock_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  analysis_result JSONB NOT NULL,
  technical_score INTEGER CHECK (technical_score BETWEEN 0 AND 100),
  entry_price NUMERIC,
  stop_loss NUMERIC,
  price_targets JSONB,
  risk_reward_ratio NUMERIC,
  timeframe TEXT CHECK (timeframe IN ('day_trade', 'swing', 'long_term')),
  setup_type TEXT,
  sentiment TEXT CHECK (sentiment IN ('bullish', 'bearish', 'neutral')),
  credits_used INTEGER DEFAULT 1
);

-- Create user watchlists table
CREATE TABLE user_watchlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  target_entry_price NUMERIC NOT NULL,
  stop_loss NUMERIC,
  position_size NUMERIC,
  notes TEXT,
  alert_triggered BOOLEAN DEFAULT FALSE,
  triggered_at TIMESTAMPTZ,
  status TEXT DEFAULT 'watching' CHECK (status IN ('watching', 'triggered', 'closed')),
  original_analysis_id UUID REFERENCES stock_analyses(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(contact_id, symbol)
);

-- Create analysis credits log table
CREATE TABLE analysis_credits_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES user_subscriptions(id),
  credits_before INTEGER NOT NULL,
  credits_after INTEGER NOT NULL,
  credits_used INTEGER NOT NULL,
  action_type TEXT CHECK (action_type IN ('analysis_request', 'monthly_reset', 'subscription_upgrade', 'manual_adjustment')),
  analysis_id UUID REFERENCES stock_analyses(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add columns to contacts table
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS trading_experience TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS trading_style TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS sectors_of_interest TEXT[];
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS assets_traded TEXT[];
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS behavioral_tags TEXT[];
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS subscription_status TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_engagement_action TEXT;

-- Enable RLS on new tables
ALTER TABLE subscription_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_watchlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_credits_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subscription_tiers (public read)
CREATE POLICY "Anyone can view subscription tiers"
  ON subscription_tiers FOR SELECT
  USING (true);

-- RLS Policies for user_subscriptions (admin/service role access)
CREATE POLICY "Authenticated users can view subscriptions"
  ON user_subscriptions FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Service role can manage subscriptions"
  ON user_subscriptions FOR ALL
  USING (auth.role() = 'service_role');

-- RLS Policies for stock_analyses (admin/service role access)
CREATE POLICY "Authenticated users can view analyses"
  ON stock_analyses FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Service role can insert analyses"
  ON stock_analyses FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- RLS Policies for user_watchlists (admin/service role access)
CREATE POLICY "Authenticated users can view watchlists"
  ON user_watchlists FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Service role can manage watchlists"
  ON user_watchlists FOR ALL
  USING (auth.role() = 'service_role');

-- RLS Policies for analysis_credits_log (admin/service role access)
CREATE POLICY "Authenticated users can view credit logs"
  ON analysis_credits_log FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Service role can manage credit logs"
  ON analysis_credits_log FOR ALL
  USING (auth.role() = 'service_role');

-- Create indexes for performance
CREATE INDEX idx_user_subscriptions_contact ON user_subscriptions(contact_id);
CREATE INDEX idx_stock_analyses_contact ON stock_analyses(contact_id);
CREATE INDEX idx_stock_analyses_symbol ON stock_analyses(symbol);
CREATE INDEX idx_user_watchlists_contact ON user_watchlists(contact_id);
CREATE INDEX idx_user_watchlists_status ON user_watchlists(status, alert_triggered);
CREATE INDEX idx_credits_log_contact ON analysis_credits_log(contact_id);

-- Seed subscription tiers
INSERT INTO subscription_tiers (name, price_monthly, credits_per_month, watchlist_slots, features) VALUES
  ('Free Trial', 0, 10, 5, '{"description": "Get started with 10 free analyses"}'),
  ('Basic', 19, 30, 10, '{"description": "30 analyses per month with 10 watchlist slots"}'),
  ('Unlimited', 49, NULL, 25, '{"description": "Unlimited analyses with priority alerts"}');

-- Create trigger for updated_at on user_subscriptions
CREATE TRIGGER update_user_subscriptions_updated_at
  BEFORE UPDATE ON user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();