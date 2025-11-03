-- Drop and recreate the handle_new_user function with auto workspace creation
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_workspace_id uuid;
  v_org_name text;
  v_org_slug text;
  v_full_name text;
BEGIN
  -- Extract full name from metadata or use email
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  
  -- Insert profile first
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    v_full_name
  );

  -- Create default organization name
  v_org_name := v_full_name || '''s Organization';
  v_org_slug := lower(regexp_replace(v_full_name || '-org-' || substring(NEW.id::text from 1 for 8), '[^a-zA-Z0-9]+', '-', 'g'));

  -- Create organization
  INSERT INTO public.organizations (name, slug, plan_type, is_agency)
  VALUES (
    v_org_name,
    v_org_slug,
    'starter',
    false
  )
  RETURNING id INTO v_org_id;

  -- Add user as organization owner
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org_id, NEW.id, 'owner');

  -- Create default workspace
  INSERT INTO public.workspaces (organization_id, name, slug)
  VALUES (
    v_org_id,
    'Main Workspace',
    'main-workspace-' || substring(NEW.id::text from 1 for 8)
  )
  RETURNING id INTO v_workspace_id;

  -- Add user as workspace owner
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (v_workspace_id, NEW.id, 'owner');

  -- Set as current workspace in profile
  UPDATE public.profiles
  SET current_workspace_id = v_workspace_id
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();