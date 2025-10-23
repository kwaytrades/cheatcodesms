-- Add customer tier and scoring fields to contacts table
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS customer_tier TEXT CHECK (customer_tier IN ('SHITLIST', 'LEAD', 'Level 1', 'Level 2', 'Level 3', 'VIP')),
  ADD COLUMN IF NOT EXISTS tier_badge_color TEXT,
  ADD COLUMN IF NOT EXISTS has_disputed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS disputed_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS likelihood_to_buy_score INTEGER CHECK (likelihood_to_buy_score >= 0 AND likelihood_to_buy_score <= 100),
  ADD COLUMN IF NOT EXISTS engagement_level TEXT CHECK (engagement_level IN ('Hot', 'Warm', 'Neutral', 'Cold', 'Frozen')),
  ADD COLUMN IF NOT EXISTS webinar_attendance JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS form_submissions JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS quiz_responses JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS address_line1 TEXT,
  ADD COLUMN IF NOT EXISTS address_line2 TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS postal_code TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT;

-- Create index for tier-based queries
CREATE INDEX IF NOT EXISTS idx_contacts_customer_tier ON contacts(customer_tier);
CREATE INDEX IF NOT EXISTS idx_contacts_likelihood_score ON contacts(likelihood_to_buy_score);
CREATE INDEX IF NOT EXISTS idx_contacts_engagement_level ON contacts(engagement_level);
CREATE INDEX IF NOT EXISTS idx_contacts_has_disputed ON contacts(has_disputed);

-- Add comment for documentation
COMMENT ON COLUMN contacts.customer_tier IS 'Customer tier: SHITLIST (disputes), LEAD ($0), Level 1 ($0.01-$499), Level 2 ($500-$999), Level 3 ($1000-$2999), VIP ($3000+)';
COMMENT ON COLUMN contacts.likelihood_to_buy_score IS 'AI-calculated score 0-100 based on revenue, engagement, and behavioral signals';
COMMENT ON COLUMN contacts.engagement_level IS 'Engagement category derived from likelihood score: Hot (80+), Warm (60-79), Neutral (40-59), Cold (20-39), Frozen (0-19)';