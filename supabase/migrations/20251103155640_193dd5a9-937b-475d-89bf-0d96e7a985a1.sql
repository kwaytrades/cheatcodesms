-- Fix infinite recursion on workspace_members SELECT policy
DROP POLICY IF EXISTS "Users can view their workspace memberships" ON workspace_members;

CREATE POLICY "Users can view their workspace memberships" ON workspace_members
  FOR SELECT
  TO PUBLIC
  USING (user_id = auth.uid());

-- Drop existing INSERT policies
DROP POLICY IF EXISTS "Anyone can insert organizations" ON organizations;
DROP POLICY IF EXISTS "Anyone can insert org members" ON organization_members;
DROP POLICY IF EXISTS "Anyone can insert workspace members" ON workspace_members;
DROP POLICY IF EXISTS "Anyone can insert profiles" ON profiles;

-- Recreate INSERT policies with TO PUBLIC keyword (applies to all roles)
CREATE POLICY "Anyone can insert organizations" ON organizations
  FOR INSERT
  TO PUBLIC
  WITH CHECK (true);

CREATE POLICY "Anyone can insert org members" ON organization_members
  FOR INSERT
  TO PUBLIC
  WITH CHECK (true);

CREATE POLICY "Anyone can insert workspace members" ON workspace_members
  FOR INSERT
  TO PUBLIC
  WITH CHECK (true);

CREATE POLICY "Anyone can insert profiles" ON profiles
  FOR INSERT
  TO PUBLIC
  WITH CHECK (true);