-- Drop the restrictive policy that conflicts with the permissive policy
-- This is blocking the signup trigger from creating workspaces
DROP POLICY IF EXISTS "Organization owners/admins can create workspaces" ON workspaces;

-- The permissive policy "Users and system can create workspaces" will remain
-- and allow the trigger to create workspaces successfully