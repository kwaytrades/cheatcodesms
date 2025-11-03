-- Drop the incorrectly configured INSERT policies
DROP POLICY IF EXISTS "Users and system can create organizations" ON organizations;
DROP POLICY IF EXISTS "Users and system can create org members" ON organization_members;
DROP POLICY IF EXISTS "Users and system can create workspace members" ON workspace_members;
DROP POLICY IF EXISTS "Users and system can create profiles" ON profiles;

-- Create new policies that apply to ALL roles (both public and authenticated)
-- By not specifying TO clause, the policy applies to all roles
CREATE POLICY "Anyone can create organizations" ON organizations
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can create org members" ON organization_members
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can create workspace members" ON workspace_members
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can create profiles" ON profiles
  FOR INSERT
  WITH CHECK (true);