-- Create sales campaigns table
CREATE TABLE ai_sales_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  agent_type TEXT NOT NULL CHECK (agent_type IN ('sales_agent', 'lead_nurture')),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  
  -- Contact filtering
  audience_filter JSONB NOT NULL DEFAULT '{}',
  contact_count INTEGER DEFAULT 0,
  
  -- Campaign configuration
  campaign_config JSONB NOT NULL DEFAULT '{}',
  
  -- Campaign settings
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  
  -- Performance metrics
  contacts_engaged INTEGER DEFAULT 0,
  messages_sent INTEGER DEFAULT 0,
  responses_received INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  
  -- Metadata
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_ai_sales_campaigns_status ON ai_sales_campaigns(status);
CREATE INDEX idx_ai_sales_campaigns_agent_type ON ai_sales_campaigns(agent_type);
CREATE INDEX idx_ai_sales_campaigns_created_at ON ai_sales_campaigns(created_at DESC);

-- Create junction table for campaign contacts
CREATE TABLE ai_sales_campaign_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES ai_sales_campaigns(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  
  -- Agent assignment tracking
  agent_id UUID,
  agent_assigned_at TIMESTAMP WITH TIME ZONE,
  campaign_day INTEGER DEFAULT 0,
  last_outreach_at TIMESTAMP WITH TIME ZONE,
  
  -- Engagement metrics
  messages_received INTEGER DEFAULT 0,
  responded BOOLEAN DEFAULT false,
  converted BOOLEAN DEFAULT false,
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'opted_out')),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(campaign_id, contact_id)
);

CREATE INDEX idx_campaign_contacts_campaign ON ai_sales_campaign_contacts(campaign_id);
CREATE INDEX idx_campaign_contacts_status ON ai_sales_campaign_contacts(status);
CREATE INDEX idx_campaign_contacts_contact ON ai_sales_campaign_contacts(contact_id);

-- Enable RLS
ALTER TABLE ai_sales_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_sales_campaign_contacts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_sales_campaigns
CREATE POLICY "Authenticated users can view campaigns"
  ON ai_sales_campaigns FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage campaigns"
  ON ai_sales_campaigns FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for ai_sales_campaign_contacts
CREATE POLICY "Authenticated users can manage campaign contacts"
  ON ai_sales_campaign_contacts FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);