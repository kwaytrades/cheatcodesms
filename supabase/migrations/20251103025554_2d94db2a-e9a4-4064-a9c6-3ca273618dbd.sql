-- Phase 2 Batch 1: Add workspace_id to Core CRM Tables
-- Tables: contacts, conversations, contact_activities, purchases, products, contact_products

-- 1. CONTACTS TABLE
ALTER TABLE contacts ADD COLUMN workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
UPDATE contacts SET workspace_id = '00000000-0000-0000-0000-000000000002' WHERE workspace_id IS NULL;
ALTER TABLE contacts ALTER COLUMN workspace_id SET NOT NULL;
CREATE INDEX idx_contacts_workspace ON contacts(workspace_id);

-- Drop old RLS policies
DROP POLICY IF EXISTS "Authenticated users can delete contacts" ON contacts;
DROP POLICY IF EXISTS "Authenticated users can insert contacts" ON contacts;
DROP POLICY IF EXISTS "Authenticated users can update contacts" ON contacts;
DROP POLICY IF EXISTS "Authenticated users can view contacts" ON contacts;

-- Create new workspace-scoped RLS policies for contacts
CREATE POLICY "Users can view contacts in their workspaces"
  ON contacts FOR SELECT
  TO authenticated
  USING (user_has_workspace_access(workspace_id));

CREATE POLICY "Users can insert contacts in their workspaces"
  ON contacts FOR INSERT
  TO authenticated
  WITH CHECK (user_has_workspace_access(workspace_id));

CREATE POLICY "Users can update contacts in their workspaces"
  ON contacts FOR UPDATE
  TO authenticated
  USING (user_has_workspace_access(workspace_id));

CREATE POLICY "Users can delete contacts in their workspaces"
  ON contacts FOR DELETE
  TO authenticated
  USING (user_has_workspace_access(workspace_id));

-- 2. CONVERSATIONS TABLE
ALTER TABLE conversations ADD COLUMN workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
UPDATE conversations SET workspace_id = '00000000-0000-0000-0000-000000000002' WHERE workspace_id IS NULL;
ALTER TABLE conversations ALTER COLUMN workspace_id SET NOT NULL;
CREATE INDEX idx_conversations_workspace ON conversations(workspace_id);

-- Drop old RLS policies
DROP POLICY IF EXISTS "Authenticated users can insert conversations" ON conversations;
DROP POLICY IF EXISTS "Authenticated users can update conversations" ON conversations;
DROP POLICY IF EXISTS "Authenticated users can view conversations" ON conversations;

-- Create new workspace-scoped RLS policies
CREATE POLICY "Users can view conversations in their workspaces"
  ON conversations FOR SELECT
  TO authenticated
  USING (user_has_workspace_access(workspace_id));

CREATE POLICY "Users can insert conversations in their workspaces"
  ON conversations FOR INSERT
  TO authenticated
  WITH CHECK (user_has_workspace_access(workspace_id));

CREATE POLICY "Users can update conversations in their workspaces"
  ON conversations FOR UPDATE
  TO authenticated
  USING (user_has_workspace_access(workspace_id));

-- 3. CONTACT_ACTIVITIES TABLE
ALTER TABLE contact_activities ADD COLUMN workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
UPDATE contact_activities SET workspace_id = '00000000-0000-0000-0000-000000000002' WHERE workspace_id IS NULL;
ALTER TABLE contact_activities ALTER COLUMN workspace_id SET NOT NULL;
CREATE INDEX idx_contact_activities_workspace ON contact_activities(workspace_id);

-- Drop old RLS policies
DROP POLICY IF EXISTS "Authenticated users can delete contact activities" ON contact_activities;
DROP POLICY IF EXISTS "Authenticated users can insert contact activities" ON contact_activities;
DROP POLICY IF EXISTS "Authenticated users can view contact activities" ON contact_activities;

-- Create new workspace-scoped RLS policies
CREATE POLICY "Users can view activities in their workspaces"
  ON contact_activities FOR SELECT
  TO authenticated
  USING (user_has_workspace_access(workspace_id));

CREATE POLICY "Users can insert activities in their workspaces"
  ON contact_activities FOR INSERT
  TO authenticated
  WITH CHECK (user_has_workspace_access(workspace_id));

CREATE POLICY "Users can delete activities in their workspaces"
  ON contact_activities FOR DELETE
  TO authenticated
  USING (user_has_workspace_access(workspace_id));

-- 4. PRODUCTS TABLE
ALTER TABLE products ADD COLUMN workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
UPDATE products SET workspace_id = '00000000-0000-0000-0000-000000000002' WHERE workspace_id IS NULL;
ALTER TABLE products ALTER COLUMN workspace_id SET NOT NULL;
CREATE INDEX idx_products_workspace ON products(workspace_id);

-- Drop old RLS policies (check if they exist first)
DROP POLICY IF EXISTS "Authenticated users can manage products" ON products;
DROP POLICY IF EXISTS "Authenticated users can view products" ON products;

-- Create new workspace-scoped RLS policies
CREATE POLICY "Users can view products in their workspaces"
  ON products FOR SELECT
  TO authenticated
  USING (user_has_workspace_access(workspace_id));

CREATE POLICY "Users can manage products in their workspaces"
  ON products FOR ALL
  TO authenticated
  USING (user_has_workspace_access(workspace_id))
  WITH CHECK (user_has_workspace_access(workspace_id));

-- 5. CONTACT_PRODUCTS TABLE
ALTER TABLE contact_products ADD COLUMN workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
UPDATE contact_products SET workspace_id = '00000000-0000-0000-0000-000000000002' WHERE workspace_id IS NULL;
ALTER TABLE contact_products ALTER COLUMN workspace_id SET NOT NULL;
CREATE INDEX idx_contact_products_workspace ON contact_products(workspace_id);

-- Drop old RLS policies
DROP POLICY IF EXISTS "Authenticated users can manage contact products" ON contact_products;

-- Create new workspace-scoped RLS policies
CREATE POLICY "Users can manage contact products in their workspaces"
  ON contact_products FOR ALL
  TO authenticated
  USING (user_has_workspace_access(workspace_id))
  WITH CHECK (user_has_workspace_access(workspace_id));