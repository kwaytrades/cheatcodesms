-- Drop the current restrictive INSERT policy on organizations
DROP POLICY IF EXISTS "Users and system can create organizations" ON organizations;

-- Create a new policy that allows both public (for triggers) and authenticated (for UI)
CREATE POLICY "Users and system can create organizations" ON organizations
  FOR INSERT
  TO public, authenticated
  WITH CHECK (true);

-- Also fix organization_members to allow both roles
DROP POLICY IF EXISTS "Users and system can create org members" ON organization_members;

CREATE POLICY "Users and system can create org members" ON organization_members
  FOR INSERT
  TO public, authenticated
  WITH CHECK (true);

-- Fix workspace_members to allow both roles
DROP POLICY IF EXISTS "Users and system can create workspace members" ON workspace_members;

CREATE POLICY "Users and system can create workspace members" ON workspace_members
  FOR INSERT
  TO public, authenticated
  WITH CHECK (true);

-- Fix profiles to allow both roles
DROP POLICY IF EXISTS "Users and system can create profiles" ON profiles;

CREATE POLICY "Users and system can create profiles" ON profiles
  FOR INSERT
  TO public, authenticated
  WITH CHECK (true);