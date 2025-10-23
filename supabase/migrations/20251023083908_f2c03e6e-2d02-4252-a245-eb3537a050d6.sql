-- Add likelihood_to_buy_score and likelihood_category columns
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS likelihood_to_buy_score integer;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS likelihood_category text;

-- Create indexes for filtering
CREATE INDEX IF NOT EXISTS idx_contacts_likelihood_score ON contacts(likelihood_to_buy_score);
CREATE INDEX IF NOT EXISTS idx_contacts_likelihood_category ON contacts(likelihood_category);