-- Phase 2 Batch 3: Add workspace_id to Automation, Content, and Agent Tables
-- Tables: automation_triggers, content_scripts, content_videos, content_folders, 
-- agent_conversations, agent_messages, product_agents, conversation_state

-- 1. AUTOMATION_TRIGGERS TABLE
ALTER TABLE automation_triggers ADD COLUMN workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
UPDATE automation_triggers SET workspace_id = '00000000-0000-0000-0000-000000000002' WHERE workspace_id IS NULL;
ALTER TABLE automation_triggers ALTER COLUMN workspace_id SET NOT NULL;
CREATE INDEX idx_automation_triggers_workspace ON automation_triggers(workspace_id);

-- Drop old RLS policies
DROP POLICY IF EXISTS "Authenticated users can delete triggers" ON automation_triggers;
DROP POLICY IF EXISTS "Authenticated users can insert triggers" ON automation_triggers;
DROP POLICY IF EXISTS "Authenticated users can update triggers" ON automation_triggers;
DROP POLICY IF EXISTS "Authenticated users can view triggers" ON automation_triggers;

-- Create new workspace-scoped RLS policies
CREATE POLICY "Users can manage triggers in their workspaces"
  ON automation_triggers FOR ALL
  TO authenticated
  USING (user_has_workspace_access(workspace_id))
  WITH CHECK (user_has_workspace_access(workspace_id));

-- 2. CONTENT_SCRIPTS TABLE (Already has user_id, add workspace_id)
ALTER TABLE content_scripts ADD COLUMN workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
UPDATE content_scripts SET workspace_id = '00000000-0000-0000-0000-000000000002' WHERE workspace_id IS NULL;
ALTER TABLE content_scripts ALTER COLUMN workspace_id SET NOT NULL;
CREATE INDEX idx_content_scripts_workspace ON content_scripts(workspace_id);

-- Drop old RLS policies
DROP POLICY IF EXISTS "Users can delete their own content scripts" ON content_scripts;
DROP POLICY IF EXISTS "Users can insert their own content scripts" ON content_scripts;
DROP POLICY IF EXISTS "Users can update their own content scripts" ON content_scripts;
DROP POLICY IF EXISTS "Users can view their own content scripts" ON content_scripts;

-- Create new workspace-scoped RLS policies
CREATE POLICY "Users can manage scripts in their workspaces"
  ON content_scripts FOR ALL
  TO authenticated
  USING (user_has_workspace_access(workspace_id))
  WITH CHECK (user_has_workspace_access(workspace_id));

-- 3. CONTENT_VIDEOS TABLE (Already has user_id, add workspace_id)
ALTER TABLE content_videos ADD COLUMN workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
UPDATE content_videos SET workspace_id = '00000000-0000-0000-0000-000000000002' WHERE workspace_id IS NULL;
ALTER TABLE content_videos ALTER COLUMN workspace_id SET NOT NULL;
CREATE INDEX idx_content_videos_workspace ON content_videos(workspace_id);

-- Drop old RLS policies
DROP POLICY IF EXISTS "Users can delete their own content videos" ON content_videos;
DROP POLICY IF EXISTS "Users can insert their own content videos" ON content_videos;
DROP POLICY IF EXISTS "Users can update their own content videos" ON content_videos;
DROP POLICY IF EXISTS "Users can view their own content videos" ON content_videos;

-- Create new workspace-scoped RLS policies
CREATE POLICY "Users can manage videos in their workspaces"
  ON content_videos FOR ALL
  TO authenticated
  USING (user_has_workspace_access(workspace_id))
  WITH CHECK (user_has_workspace_access(workspace_id));

-- 4. CONTENT_FOLDERS TABLE (Already has user_id, add workspace_id)
ALTER TABLE content_folders ADD COLUMN workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
UPDATE content_folders SET workspace_id = '00000000-0000-0000-0000-000000000002' WHERE workspace_id IS NULL;
ALTER TABLE content_folders ALTER COLUMN workspace_id SET NOT NULL;
CREATE INDEX idx_content_folders_workspace ON content_folders(workspace_id);

-- Drop old RLS policies
DROP POLICY IF EXISTS "Users can delete their own content folders" ON content_folders;
DROP POLICY IF EXISTS "Users can insert their own content folders" ON content_folders;
DROP POLICY IF EXISTS "Users can update their own content folders" ON content_folders;
DROP POLICY IF EXISTS "Users can view their own content folders" ON content_folders;

-- Create new workspace-scoped RLS policies
CREATE POLICY "Users can manage folders in their workspaces"
  ON content_folders FOR ALL
  TO authenticated
  USING (user_has_workspace_access(workspace_id))
  WITH CHECK (user_has_workspace_access(workspace_id));

-- 5. AGENT_CONVERSATIONS TABLE
ALTER TABLE agent_conversations ADD COLUMN workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
UPDATE agent_conversations SET workspace_id = '00000000-0000-0000-0000-000000000002' WHERE workspace_id IS NULL;
ALTER TABLE agent_conversations ALTER COLUMN workspace_id SET NOT NULL;
CREATE INDEX idx_agent_conversations_workspace ON agent_conversations(workspace_id);

-- Drop old RLS policies
DROP POLICY IF EXISTS "Authenticated users can manage agent conversations" ON agent_conversations;

-- Create new workspace-scoped RLS policies
CREATE POLICY "Users can manage agent conversations in their workspaces"
  ON agent_conversations FOR ALL
  TO authenticated
  USING (user_has_workspace_access(workspace_id))
  WITH CHECK (user_has_workspace_access(workspace_id));

-- 6. AGENT_MESSAGES TABLE
ALTER TABLE agent_messages ADD COLUMN workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
UPDATE agent_messages SET workspace_id = '00000000-0000-0000-0000-000000000002' WHERE workspace_id IS NULL;
ALTER TABLE agent_messages ALTER COLUMN workspace_id SET NOT NULL;
CREATE INDEX idx_agent_messages_workspace ON agent_messages(workspace_id);

-- Drop old RLS policies
DROP POLICY IF EXISTS "Authenticated users can manage agent messages" ON agent_messages;

-- Create new workspace-scoped RLS policies
CREATE POLICY "Users can manage agent messages in their workspaces"
  ON agent_messages FOR ALL
  TO authenticated
  USING (user_has_workspace_access(workspace_id))
  WITH CHECK (user_has_workspace_access(workspace_id));

-- 7. PRODUCT_AGENTS TABLE
ALTER TABLE product_agents ADD COLUMN workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
UPDATE product_agents SET workspace_id = '00000000-0000-0000-0000-000000000002' WHERE workspace_id IS NULL;
ALTER TABLE product_agents ALTER COLUMN workspace_id SET NOT NULL;
CREATE INDEX idx_product_agents_workspace ON product_agents(workspace_id);

-- Drop old RLS policies
DROP POLICY IF EXISTS "Authenticated users can manage product agents" ON product_agents;
DROP POLICY IF EXISTS "Authenticated users can view product agents" ON product_agents;

-- Create new workspace-scoped RLS policies
CREATE POLICY "Users can manage product agents in their workspaces"
  ON product_agents FOR ALL
  TO authenticated
  USING (user_has_workspace_access(workspace_id))
  WITH CHECK (user_has_workspace_access(workspace_id));

-- 8. CONVERSATION_STATE TABLE
ALTER TABLE conversation_state ADD COLUMN workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
UPDATE conversation_state SET workspace_id = '00000000-0000-0000-0000-000000000002' WHERE workspace_id IS NULL;
ALTER TABLE conversation_state ALTER COLUMN workspace_id SET NOT NULL;
CREATE INDEX idx_conversation_state_workspace ON conversation_state(workspace_id);

-- Drop old RLS policies
DROP POLICY IF EXISTS "Authenticated users can manage conversation state" ON conversation_state;
DROP POLICY IF EXISTS "Authenticated users can view conversation state" ON conversation_state;

-- Create new workspace-scoped RLS policies
CREATE POLICY "Users can manage conversation state in their workspaces"
  ON conversation_state FOR ALL
  TO authenticated
  USING (user_has_workspace_access(workspace_id))
  WITH CHECK (user_has_workspace_access(workspace_id));