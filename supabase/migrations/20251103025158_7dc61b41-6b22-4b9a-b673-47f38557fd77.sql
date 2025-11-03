-- Phase 2: Data Migration Setup
-- Create default organization and workspace for existing data

-- Insert default organization (will be used for all existing data)
INSERT INTO organizations (id, name, slug, plan_type, is_agency)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Default Organization',
  'default',
  'professional',
  false
)
ON CONFLICT (id) DO NOTHING;

-- Insert default workspace
INSERT INTO workspaces (id, organization_id, name, slug)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'Main Workspace',
  'main'
)
ON CONFLICT (id) DO NOTHING;

-- Add all existing users to the default organization and workspace
INSERT INTO organization_members (organization_id, user_id, role)
SELECT 
  '00000000-0000-0000-0000-000000000001',
  id,
  'owner'
FROM auth.users
ON CONFLICT (organization_id, user_id) DO NOTHING;

INSERT INTO workspace_members (workspace_id, user_id, role)
SELECT 
  '00000000-0000-0000-0000-000000000002',
  id,
  'owner'
FROM auth.users
ON CONFLICT (workspace_id, user_id) DO NOTHING;

-- Update all existing profiles to use the default workspace
UPDATE profiles
SET current_workspace_id = '00000000-0000-0000-0000-000000000002'
WHERE current_workspace_id IS NULL;