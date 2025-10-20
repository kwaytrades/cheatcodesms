-- Add new fields to contacts table
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lead_status TEXT DEFAULT 'new';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS trading_experience TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS trading_style TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS account_size TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS assets_traded TEXT[];
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS risk_tolerance TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS time_availability TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS goals TEXT[];
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS total_spent DECIMAL(10,2) DEFAULT 0;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS subscription_status TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lead_source TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS utm_campaign TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS referrer TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS objections TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS sentiment TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS preferred_contact_method TEXT DEFAULT 'email';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS avg_response_time INTEGER;

-- Create segments table for saved filters
CREATE TABLE IF NOT EXISTS segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  folder TEXT,
  filter_config JSONB NOT NULL,
  is_dynamic BOOLEAN DEFAULT true,
  visibility TEXT DEFAULT 'private',
  created_by UUID REFERENCES auth.users(id),
  customer_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create automation triggers table
CREATE TABLE IF NOT EXISTS automation_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  trigger_config JSONB NOT NULL,
  condition_config JSONB,
  action_type TEXT NOT NULL,
  action_config JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  stats JSONB DEFAULT '{"sent": 0, "opened": 0, "replied": 0, "converted": 0}'::jsonb,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_fired_at TIMESTAMPTZ
);

-- Create AI-generated messages log
CREATE TABLE IF NOT EXISTS ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  trigger_id UUID REFERENCES automation_triggers(id),
  message_body TEXT NOT NULL,
  channel TEXT NOT NULL,
  subject TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  opened BOOLEAN DEFAULT false,
  opened_at TIMESTAMPTZ,
  replied BOOLEAN DEFAULT false,
  replied_at TIMESTAMPTZ,
  converted BOOLEAN DEFAULT false,
  converted_at TIMESTAMPTZ,
  customer_context JSONB,
  ai_prompt TEXT
);

-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2),
  category TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create purchases table
CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  stripe_charge_id TEXT UNIQUE,
  amount DECIMAL(10,2) NOT NULL,
  purchase_date TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'completed',
  metadata JSONB
);

-- Create contact assignments table
CREATE TABLE IF NOT EXISTS contact_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_by UUID REFERENCES auth.users(id),
  UNIQUE(contact_id, assigned_to)
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  is_read BOOLEAN DEFAULT false,
  snoozed_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on new tables
ALTER TABLE segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for segments
CREATE POLICY "Users can view their own and shared segments" ON segments
  FOR SELECT USING (
    auth.uid() = created_by OR visibility = 'shared'
  );

CREATE POLICY "Users can insert their own segments" ON segments
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own segments" ON segments
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own segments" ON segments
  FOR DELETE USING (auth.uid() = created_by);

-- RLS Policies for automation_triggers
CREATE POLICY "Authenticated users can view triggers" ON automation_triggers
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert triggers" ON automation_triggers
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update triggers" ON automation_triggers
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete triggers" ON automation_triggers
  FOR DELETE USING (auth.role() = 'authenticated');

-- RLS Policies for ai_messages
CREATE POLICY "Authenticated users can view ai_messages" ON ai_messages
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert ai_messages" ON ai_messages
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- RLS Policies for products
CREATE POLICY "Authenticated users can view products" ON products
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage products" ON products
  FOR ALL USING (auth.role() = 'authenticated');

-- RLS Policies for purchases
CREATE POLICY "Authenticated users can view purchases" ON purchases
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert purchases" ON purchases
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- RLS Policies for contact_assignments
CREATE POLICY "Authenticated users can view assignments" ON contact_assignments
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage assignments" ON contact_assignments
  FOR ALL USING (auth.role() = 'authenticated');

-- RLS Policies for notifications
CREATE POLICY "Users can view their own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notifications" ON notifications
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications" ON notifications
  FOR INSERT WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_contacts_lead_status ON contacts(lead_status);
CREATE INDEX IF NOT EXISTS idx_contacts_lead_score ON contacts(lead_score);
CREATE INDEX IF NOT EXISTS idx_contacts_last_contact_date ON contacts(last_contact_date);
CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON contacts(created_at);
CREATE INDEX IF NOT EXISTS idx_purchases_contact_id ON purchases(contact_id);
CREATE INDEX IF NOT EXISTS idx_purchases_purchase_date ON purchases(purchase_date);
CREATE INDEX IF NOT EXISTS idx_activities_contact_id ON contact_activities(contact_id);
CREATE INDEX IF NOT EXISTS idx_activities_created_at ON contact_activities(created_at);
CREATE INDEX IF NOT EXISTS idx_segments_created_by ON segments(created_by);
CREATE INDEX IF NOT EXISTS idx_ai_messages_contact_id ON ai_messages(contact_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id, is_read);

-- Function to calculate lead score
CREATE OR REPLACE FUNCTION calculate_lead_score(p_contact_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_score INTEGER := 0;
  v_email_opens INTEGER;
  v_sms_replies INTEGER;
  v_purchases INTEGER;
BEGIN
  -- Count email opens (weight: 20 points max)
  SELECT COUNT(*) INTO v_email_opens
  FROM contact_activities
  WHERE contact_id = p_contact_id AND activity_type = 'email_open'
  AND created_at > NOW() - INTERVAL '30 days';
  v_score := v_score + LEAST(v_email_opens * 2, 20);
  
  -- Count SMS replies (weight: 25 points max)
  SELECT COUNT(*) INTO v_sms_replies
  FROM contact_activities
  WHERE contact_id = p_contact_id AND activity_type = 'sms_reply'
  AND created_at > NOW() - INTERVAL '30 days';
  v_score := v_score + LEAST(v_sms_replies * 5, 25);
  
  -- Count purchases (weight: 30 points max)
  SELECT COUNT(*) INTO v_purchases
  FROM purchases
  WHERE contact_id = p_contact_id AND status = 'completed';
  v_score := v_score + LEAST(v_purchases * 15, 30);
  
  -- Cap at 100
  RETURN LEAST(v_score, 100);
END;
$$ LANGUAGE plpgsql;

-- Function to get customer context for AI
CREATE OR REPLACE FUNCTION get_customer_context(p_contact_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_context JSONB;
BEGIN
  SELECT jsonb_build_object(
    'contact', row_to_json(c.*),
    'purchases', COALESCE(
      (SELECT jsonb_agg(row_to_json(p.*))
       FROM purchases p
       WHERE p.contact_id = c.id
       ORDER BY p.purchase_date DESC),
      '[]'::jsonb
    ),
    'recent_activities', COALESCE(
      (SELECT jsonb_agg(row_to_json(a.*))
       FROM contact_activities a
       WHERE a.contact_id = c.id
       ORDER BY a.created_at DESC
       LIMIT 10),
      '[]'::jsonb
    ),
    'previous_ai_messages', COALESCE(
      (SELECT jsonb_agg(row_to_json(m.*))
       FROM ai_messages m
       WHERE m.contact_id = c.id
       ORDER BY m.sent_at DESC
       LIMIT 5),
      '[]'::jsonb
    )
  ) INTO v_context
  FROM contacts c
  WHERE c.id = p_contact_id;
  
  RETURN v_context;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to update segments updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_segments_updated_at BEFORE UPDATE ON segments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_automation_triggers_updated_at BEFORE UPDATE ON automation_triggers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();