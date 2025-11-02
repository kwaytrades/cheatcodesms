-- Phase 1: Add Influencer-Specific Columns to contacts Table
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS platform text,
ADD COLUMN IF NOT EXISTS platform_handle text,
ADD COLUMN IF NOT EXISTS follower_count integer,
ADD COLUMN IF NOT EXISTS engagement_rate numeric(5,2),
ADD COLUMN IF NOT EXISTS influencer_tier text,
ADD COLUMN IF NOT EXISTS niche_categories text[],
ADD COLUMN IF NOT EXISTS content_topics text[],
ADD COLUMN IF NOT EXISTS avg_views integer,
ADD COLUMN IF NOT EXISTS collaboration_history jsonb DEFAULT '[]'::jsonb;

-- Create influencer_profiles table
CREATE TABLE IF NOT EXISTS influencer_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid REFERENCES contacts(id) ON DELETE CASCADE UNIQUE,
  
  -- Platform Presence
  tiktok_handle text,
  youtube_channel text,
  instagram_handle text,
  blog_url text,
  twitter_handle text,
  
  -- Metrics per Platform (JSON structure for flexibility)
  platform_metrics jsonb DEFAULT '{}'::jsonb,
  
  -- Collaboration Details
  rate_card jsonb DEFAULT '{}'::jsonb,
  preferred_collaboration_types text[],
  
  -- Content Analysis
  content_style text,
  audience_demographics jsonb,
  past_brand_collabs text[],
  
  -- Outreach History
  last_outreach_date timestamp with time zone,
  outreach_count integer DEFAULT 0,
  response_rate numeric(5,2),
  
  -- Status
  outreach_status text DEFAULT 'not_contacted',
  
  -- Relationship Quality
  relationship_score integer DEFAULT 0,
  notes text,
  
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create indexes for influencer_profiles
CREATE INDEX IF NOT EXISTS idx_influencer_profiles_contact ON influencer_profiles(contact_id);
CREATE INDEX IF NOT EXISTS idx_influencer_profiles_status ON influencer_profiles(outreach_status);

-- Enable RLS on influencer_profiles
ALTER TABLE influencer_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for influencer_profiles
CREATE POLICY "Authenticated users can manage influencer profiles"
  ON influencer_profiles
  FOR ALL
  USING (auth.role() = 'authenticated');

-- Create influencer_campaigns table
CREATE TABLE IF NOT EXISTS influencer_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_campaign_id uuid REFERENCES ai_sales_campaigns(id) ON DELETE CASCADE,
  
  -- Campaign Goals
  campaign_type text NOT NULL,
  target_platforms text[],
  target_niches text[],
  target_tier text[],
  
  -- Budget & Compensation
  budget_total numeric(10,2),
  budget_remaining numeric(10,2),
  compensation_model text,
  
  -- Deliverables
  expected_deliverables jsonb,
  
  -- Content Guidelines
  content_guidelines text,
  brand_messaging text[],
  hashtags text[],
  must_mention text[],
  prohibited_topics text[],
  
  -- Tracking
  influencers_contacted integer DEFAULT 0,
  influencers_interested integer DEFAULT 0,
  contracts_signed integer DEFAULT 0,
  content_pieces_delivered integer DEFAULT 0,
  
  -- Performance
  total_reach integer DEFAULT 0,
  total_engagement integer DEFAULT 0,
  conversion_tracking_links jsonb DEFAULT '{}'::jsonb,
  
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create index for influencer_campaigns
CREATE INDEX IF NOT EXISTS idx_influencer_campaigns_sales_campaign ON influencer_campaigns(sales_campaign_id);

-- Enable RLS on influencer_campaigns
ALTER TABLE influencer_campaigns ENABLE ROW LEVEL SECURITY;

-- RLS Policies for influencer_campaigns
CREATE POLICY "Authenticated users can manage influencer campaigns"
  ON influencer_campaigns
  FOR ALL
  USING (auth.role() = 'authenticated');

-- Add influencer_outreach to agent_type_configs if not exists
INSERT INTO agent_type_configs (
  agent_type,
  system_prompt,
  first_message_template,
  follow_up_template,
  tone,
  max_messages_per_week,
  is_active,
  campaign_config
)
VALUES (
  'influencer_outreach',
  'You are Ivy, a professional influencer partnership manager representing {company_name}. 

Your role is to build authentic relationships with content creators and propose mutually beneficial collaborations.

**Key Responsibilities:**
1. Personalized outreach based on creator''s content style and audience
2. Clearly communicate collaboration opportunities and compensation
3. Address questions about deliverables, timelines, and brand guidelines
4. Maintain professionalism while being warm and approachable
5. Respect creators'' time and boundaries

**Tone & Style:**
- Professional but conversational
- Show genuine appreciation for their content
- Be transparent about expectations
- Don''t be pushy - focus on value exchange
- Reference specific content pieces to show you''ve done research

**Campaign Context:**
{campaign_context}

**Products/Offerings:**
{products}

**Collaboration Details:**
{collaboration_details}

**Guidelines:**
- Never promise what you can''t deliver
- Be clear about compensation upfront when asked
- If they''re interested, move to scheduling a call/sending full brief
- If not interested, thank them and keep door open for future
- Track all commitments and follow through',
  'Hi {name}! 👋

I''ve been following your {platform} content, especially your recent post about {specific_content}. Your perspective on {topic} really resonated with our brand.

I''m reaching out because we''re launching {campaign_name} and think your audience would love to hear about {product}. 

We''re looking for authentic creators who align with our values around {brand_values}.

Would you be open to exploring a collaboration? Happy to share more details about what we have in mind and how we compensate our partners.

Best,
Ivy
{company_name}',
  'Hey {name},

Just wanted to follow up on my message about collaborating on {campaign_name}. 

I know you''re probably busy, but wanted to make sure this didn''t get buried. We have flexibility on deliverables and would love to work with you.

No pressure at all - just let me know if you''d like to chat!

- Ivy',
  'professional',
  5,
  true,
  '{"duration_days": 90, "frequency_limits": {"max_per_day": 2, "max_per_week": 5, "min_hours_between": 24}, "outreach_schedule": [{"day": 0, "action": "send_introduction"}, {"day": 3, "action": "follow_up_if_no_response"}, {"day": 7, "action": "final_follow_up"}], "milestone_triggers": []}'::jsonb
)
ON CONFLICT (agent_type) DO UPDATE
SET 
  system_prompt = EXCLUDED.system_prompt,
  first_message_template = EXCLUDED.first_message_template,
  follow_up_template = EXCLUDED.follow_up_template,
  campaign_config = EXCLUDED.campaign_config;