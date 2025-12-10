-- Add policy to allow all authenticated users to view the default workspace
CREATE POLICY "All users can view default workspace"
ON public.workspaces
FOR SELECT
TO authenticated
USING (id = '00000000-0000-0000-0000-000000000002'::uuid);

-- Add policy to allow all authenticated users to be members of the default workspace
CREATE POLICY "All users can view default workspace members"
ON public.workspace_members
FOR SELECT
TO authenticated
USING (workspace_id = '00000000-0000-0000-0000-000000000002'::uuid);

-- Update the user_has_workspace_access function to also check for the default workspace
CREATE OR REPLACE FUNCTION public.user_has_workspace_access(workspace_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- Default workspace is accessible to all authenticated users
    workspace_uuid = '00000000-0000-0000-0000-000000000002'::uuid
    OR EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = workspace_uuid
      AND user_id = auth.uid()
    )
$$;