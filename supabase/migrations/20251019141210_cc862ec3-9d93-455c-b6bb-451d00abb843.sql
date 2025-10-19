-- Create contacts table
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  monday_item_id TEXT UNIQUE,
  first_name TEXT,
  last_name TEXT,
  full_name TEXT NOT NULL,
  email TEXT,
  phone_number TEXT,
  status TEXT,
  lead_score INTEGER,
  products_interested TEXT[],
  products_owned TEXT[],
  tags TEXT[],
  notes TEXT,
  monday_board_id TEXT,
  monday_board_name TEXT,
  last_contact_date TIMESTAMPTZ,
  engagement_score INTEGER DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at TIMESTAMPTZ
);

CREATE INDEX idx_contacts_phone ON contacts(phone_number);
CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_monday_id ON contacts(monday_item_id);
CREATE INDEX idx_contacts_status ON contacts(status);

-- Enable Row Level Security
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for contacts
CREATE POLICY "Authenticated users can view contacts"
  ON contacts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert contacts"
  ON contacts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update contacts"
  ON contacts FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete contacts"
  ON contacts FOR DELETE
  TO authenticated
  USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Update conversations table to link to contacts
ALTER TABLE conversations
ADD COLUMN contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;

CREATE INDEX idx_conversations_contact ON conversations(contact_id);

-- Create contact activities table for tracking all interactions
CREATE TABLE contact_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contact_activities_contact ON contact_activities(contact_id, created_at DESC);

ALTER TABLE contact_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view contact activities"
  ON contact_activities FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert contact activities"
  ON contact_activities FOR INSERT
  TO authenticated
  WITH CHECK (true);