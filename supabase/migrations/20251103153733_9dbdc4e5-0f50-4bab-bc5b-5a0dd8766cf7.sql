-- First, drop ALL existing INSERT policies on these tables to start fresh
DROP POLICY IF EXISTS "Users and system can create organizations" ON organizations;
DROP POLICY IF EXISTS "Anyone can create organizations" ON organizations;
DROP POLICY IF EXISTS "Users and system can create org members" ON organization_members;
DROP POLICY IF EXISTS "Anyone can create org members" ON organization_members;
DROP POLICY IF EXISTS "Users and system can create workspace members" ON workspace_members;
DROP POLICY IF EXISTS "Anyone can create workspace members" ON workspace_members;
DROP POLICY IF EXISTS "Users and system can create profiles" ON profiles;
DROP POLICY IF EXISTS "Anyone can create profiles" ON profiles;

-- Now create new policies without TO clause (applies to all roles)
CREATE POLICY "Anyone can insert organizations" ON organizations
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can insert org members" ON organization_members
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can insert workspace members" ON workspace_members
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can insert profiles" ON profiles
  FOR INSERT
  WITH CHECK (true);