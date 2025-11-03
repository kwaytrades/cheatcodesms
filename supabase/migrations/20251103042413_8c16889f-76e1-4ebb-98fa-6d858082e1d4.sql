-- Fix RLS policies to allow SECURITY DEFINER functions (like signup trigger) to create records

-- Organizations
DROP POLICY IF EXISTS "Users and system can create organizations" ON organizations;
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON organizations;
CREATE POLICY "Users and system can create organizations"
  ON organizations FOR INSERT
  WITH CHECK (true);

-- Organization Members  
DROP POLICY IF EXISTS "Users and system can create organization memberships" ON organization_members;
DROP POLICY IF EXISTS "Users can manage their organization memberships" ON organization_members;
DROP POLICY IF EXISTS "Users can view their organization memberships" ON organization_members;

CREATE POLICY "Users and system can create organization memberships"
  ON organization_members FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can view their organization memberships"
  ON organization_members FOR SELECT
  USING (user_id = auth.uid());

-- Workspaces
DROP POLICY IF EXISTS "Users and system can create workspaces" ON workspaces;
DROP POLICY IF EXISTS "Users can manage workspaces in their organizations" ON workspaces;
DROP POLICY IF EXISTS "Users can view workspaces in their organizations" ON workspaces;
DROP POLICY IF EXISTS "Users can update workspaces in their organizations" ON workspaces;

CREATE POLICY "Users and system can create workspaces"
  ON workspaces FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can view workspaces in their organizations"
  ON workspaces FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = workspaces.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update workspaces in their organizations"
  ON workspaces FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = workspaces.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role IN ('owner', 'admin')
    )
  );

-- Workspace Members
DROP POLICY IF EXISTS "Users and system can create workspace memberships" ON workspace_members;
DROP POLICY IF EXISTS "Users can manage workspace memberships" ON workspace_members;
DROP POLICY IF EXISTS "Users can view their workspace memberships" ON workspace_members;

CREATE POLICY "Users and system can create workspace memberships"
  ON workspace_members FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can view their workspace memberships"
  ON workspace_members FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
      AND wm.user_id = auth.uid()
    )
  );

-- Profiles
DROP POLICY IF EXISTS "Users and system can create profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

CREATE POLICY "Users and system can create profiles"
  ON profiles FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid());