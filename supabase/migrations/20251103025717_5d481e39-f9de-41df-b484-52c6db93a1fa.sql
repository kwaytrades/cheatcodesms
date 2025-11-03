-- Phase 2 Batch 2: Add workspace_id to Campaign Tables
-- Tables: campaigns, campaign_messages, ai_sales_campaigns, ai_sales_campaign_contacts, campaign_products

-- 1. CAMPAIGNS TABLE
ALTER TABLE campaigns ADD COLUMN workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
UPDATE campaigns SET workspace_id = '00000000-0000-0000-0000-000000000002' WHERE workspace_id IS NULL;
ALTER TABLE campaigns ALTER COLUMN workspace_id SET NOT NULL;
CREATE INDEX idx_campaigns_workspace ON campaigns(workspace_id);

-- Drop old RLS policies
DROP POLICY IF EXISTS "Authenticated users can create campaigns" ON campaigns;
DROP POLICY IF EXISTS "Authenticated users can update campaigns" ON campaigns;
DROP POLICY IF EXISTS "Authenticated users can view campaigns" ON campaigns;

-- Create new workspace-scoped RLS policies
CREATE POLICY "Users can view campaigns in their workspaces"
  ON campaigns FOR SELECT
  TO authenticated
  USING (user_has_workspace_access(workspace_id));

CREATE POLICY "Users can create campaigns in their workspaces"
  ON campaigns FOR INSERT
  TO authenticated
  WITH CHECK (user_has_workspace_access(workspace_id));

CREATE POLICY "Users can update campaigns in their workspaces"
  ON campaigns FOR UPDATE
  TO authenticated
  USING (user_has_workspace_access(workspace_id));

-- 2. CAMPAIGN_MESSAGES TABLE
ALTER TABLE campaign_messages ADD COLUMN workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
UPDATE campaign_messages SET workspace_id = '00000000-0000-0000-0000-000000000002' WHERE workspace_id IS NULL;
ALTER TABLE campaign_messages ALTER COLUMN workspace_id SET NOT NULL;
CREATE INDEX idx_campaign_messages_workspace ON campaign_messages(workspace_id);

-- Drop old RLS policies
DROP POLICY IF EXISTS "Authenticated users can insert campaign messages" ON campaign_messages;
DROP POLICY IF EXISTS "Authenticated users can view campaign messages" ON campaign_messages;

-- Create new workspace-scoped RLS policies
CREATE POLICY "Users can view campaign messages in their workspaces"
  ON campaign_messages FOR SELECT
  TO authenticated
  USING (user_has_workspace_access(workspace_id));

CREATE POLICY "Users can insert campaign messages in their workspaces"
  ON campaign_messages FOR INSERT
  TO authenticated
  WITH CHECK (user_has_workspace_access(workspace_id));

-- 3. AI_SALES_CAMPAIGNS TABLE
ALTER TABLE ai_sales_campaigns ADD COLUMN workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
UPDATE ai_sales_campaigns SET workspace_id = '00000000-0000-0000-0000-000000000002' WHERE workspace_id IS NULL;
ALTER TABLE ai_sales_campaigns ALTER COLUMN workspace_id SET NOT NULL;
CREATE INDEX idx_ai_sales_campaigns_workspace ON ai_sales_campaigns(workspace_id);

-- Drop old RLS policies
DROP POLICY IF EXISTS "Authenticated users can manage campaigns" ON ai_sales_campaigns;
DROP POLICY IF EXISTS "Authenticated users can view campaigns" ON ai_sales_campaigns;

-- Create new workspace-scoped RLS policies
CREATE POLICY "Users can view AI sales campaigns in their workspaces"
  ON ai_sales_campaigns FOR SELECT
  TO authenticated
  USING (user_has_workspace_access(workspace_id));

CREATE POLICY "Users can manage AI sales campaigns in their workspaces"
  ON ai_sales_campaigns FOR ALL
  TO authenticated
  USING (user_has_workspace_access(workspace_id))
  WITH CHECK (user_has_workspace_access(workspace_id));

-- 4. AI_SALES_CAMPAIGN_CONTACTS TABLE
ALTER TABLE ai_sales_campaign_contacts ADD COLUMN workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
UPDATE ai_sales_campaign_contacts SET workspace_id = '00000000-0000-0000-0000-000000000002' WHERE workspace_id IS NULL;
ALTER TABLE ai_sales_campaign_contacts ALTER COLUMN workspace_id SET NOT NULL;
CREATE INDEX idx_ai_sales_campaign_contacts_workspace ON ai_sales_campaign_contacts(workspace_id);

-- Drop old RLS policies
DROP POLICY IF EXISTS "Authenticated users can manage campaign contacts" ON ai_sales_campaign_contacts;

-- Create new workspace-scoped RLS policies
CREATE POLICY "Users can manage campaign contacts in their workspaces"
  ON ai_sales_campaign_contacts FOR ALL
  TO authenticated
  USING (user_has_workspace_access(workspace_id))
  WITH CHECK (user_has_workspace_access(workspace_id));

-- 5. CAMPAIGN_PRODUCTS TABLE
ALTER TABLE campaign_products ADD COLUMN workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
UPDATE campaign_products SET workspace_id = '00000000-0000-0000-0000-000000000002' WHERE workspace_id IS NULL;
ALTER TABLE campaign_products ALTER COLUMN workspace_id SET NOT NULL;
CREATE INDEX idx_campaign_products_workspace ON campaign_products(workspace_id);

-- Drop old RLS policies
DROP POLICY IF EXISTS "Authenticated users can manage campaign products" ON campaign_products;

-- Create new workspace-scoped RLS policies
CREATE POLICY "Users can manage campaign products in their workspaces"
  ON campaign_products FOR ALL
  TO authenticated
  USING (user_has_workspace_access(workspace_id))
  WITH CHECK (user_has_workspace_access(workspace_id));