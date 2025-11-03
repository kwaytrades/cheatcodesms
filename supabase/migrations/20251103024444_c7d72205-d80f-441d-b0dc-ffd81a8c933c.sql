-- Phase 1: Core Multi-Tenancy Infrastructure
-- This migration creates the foundation for agency-level multi-tenancy

-- Create organization_role enum
CREATE TYPE organization_role AS ENUM (
  'owner',
  'admin',
  'member'
);

-- Create workspace_role enum
CREATE TYPE workspace_role AS ENUM (
  'owner',
  'admin',
  'manager',
  'viewer'
);

-- Create organizations table (Agency Level)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  plan_type TEXT NOT NULL DEFAULT 'starter',
  is_agency BOOLEAN DEFAULT false,
  parent_organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  settings JSONB DEFAULT '{}',
  branding JSONB DEFAULT '{
    "logo_url": null,
    "primary_color": "#000000",
    "custom_domain": null,
    "company_name": null
  }',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create workspaces table (Sub-accounts/Clients)
CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  settings JSONB DEFAULT '{}',
  limits JSONB DEFAULT '{
    "contacts": 10000,
    "campaigns": 100,
    "messages_per_month": 10000,
    "storage_mb": 5000
  }',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, slug)
);

-- Create organization_members table
CREATE TABLE organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role organization_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

-- Create workspace_members table
CREATE TABLE workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role workspace_role NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

-- Create profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  current_workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create workspace_invitations table
CREATE TABLE workspace_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  role workspace_role NOT NULL DEFAULT 'viewer',
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create workspace_usage table for tracking limits
CREATE TABLE workspace_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  contacts_count INTEGER DEFAULT 0,
  messages_sent INTEGER DEFAULT 0,
  campaigns_active INTEGER DEFAULT 0,
  storage_used_mb INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, period_start)
);

-- Create indexes for performance
CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_workspaces_organization ON workspaces(organization_id);
CREATE INDEX idx_workspaces_slug ON workspaces(organization_id, slug);
CREATE INDEX idx_organization_members_user ON organization_members(user_id);
CREATE INDEX idx_organization_members_org ON organization_members(organization_id);
CREATE INDEX idx_workspace_members_user ON workspace_members(user_id);
CREATE INDEX idx_workspace_members_workspace ON workspace_members(workspace_id);
CREATE INDEX idx_profiles_workspace ON profiles(current_workspace_id);
CREATE INDEX idx_invitations_email ON workspace_invitations(email);
CREATE INDEX idx_invitations_token ON workspace_invitations(token);
CREATE INDEX idx_usage_workspace ON workspace_usage(workspace_id, period_start);

-- Function: Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function: Check if user has workspace access (SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION user_has_workspace_access(workspace_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = workspace_uuid
    AND user_id = auth.uid()
  )
$$;

-- Function: Check if user has organization access
CREATE OR REPLACE FUNCTION user_has_organization_access(org_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_uuid
    AND user_id = auth.uid()
  )
$$;

-- Function: Get user's workspace role
CREATE OR REPLACE FUNCTION get_user_workspace_role(workspace_uuid UUID)
RETURNS workspace_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM workspace_members
  WHERE workspace_id = workspace_uuid
  AND user_id = auth.uid()
  LIMIT 1
$$;

-- Function: Get user's organization role
CREATE OR REPLACE FUNCTION get_user_organization_role(org_uuid UUID)
RETURNS organization_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM organization_members
  WHERE organization_id = org_uuid
  AND user_id = auth.uid()
  LIMIT 1
$$;

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Add triggers for updated_at
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_workspaces_updated_at
  BEFORE UPDATE ON workspaces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Organizations
CREATE POLICY "Users can view organizations they belong to"
  ON organizations FOR SELECT
  TO authenticated
  USING (user_has_organization_access(id));

CREATE POLICY "Organization owners can update their organization"
  ON organizations FOR UPDATE
  TO authenticated
  USING (get_user_organization_role(id) IN ('owner', 'admin'));

CREATE POLICY "Authenticated users can create organizations"
  ON organizations FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies: Workspaces
CREATE POLICY "Users can view workspaces they have access to"
  ON workspaces FOR SELECT
  TO authenticated
  USING (user_has_workspace_access(id));

CREATE POLICY "Organization members can view their org's workspaces"
  ON workspaces FOR SELECT
  TO authenticated
  USING (user_has_organization_access(organization_id));

CREATE POLICY "Organization owners/admins can create workspaces"
  ON workspaces FOR INSERT
  TO authenticated
  WITH CHECK (get_user_organization_role(organization_id) IN ('owner', 'admin'));

CREATE POLICY "Workspace owners can update their workspace"
  ON workspaces FOR UPDATE
  TO authenticated
  USING (get_user_workspace_role(id) IN ('owner', 'admin'));

CREATE POLICY "Organization owners can update workspaces"
  ON workspaces FOR UPDATE
  TO authenticated
  USING (get_user_organization_role(organization_id) IN ('owner', 'admin'));

-- RLS Policies: Organization Members
CREATE POLICY "Users can view organization members of their orgs"
  ON organization_members FOR SELECT
  TO authenticated
  USING (user_has_organization_access(organization_id));

CREATE POLICY "Organization owners can manage members"
  ON organization_members FOR ALL
  TO authenticated
  USING (get_user_organization_role(organization_id) IN ('owner', 'admin'));

-- RLS Policies: Workspace Members
CREATE POLICY "Users can view workspace members of their workspaces"
  ON workspace_members FOR SELECT
  TO authenticated
  USING (user_has_workspace_access(workspace_id));

CREATE POLICY "Workspace owners can manage members"
  ON workspace_members FOR ALL
  TO authenticated
  USING (get_user_workspace_role(workspace_id) IN ('owner', 'admin'));

-- RLS Policies: Profiles
CREATE POLICY "Users can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

-- RLS Policies: Workspace Invitations
CREATE POLICY "Users can view invitations for their workspaces"
  ON workspace_invitations FOR SELECT
  TO authenticated
  USING (user_has_workspace_access(workspace_id) OR email = auth.jwt()->>'email');

CREATE POLICY "Workspace admins can create invitations"
  ON workspace_invitations FOR INSERT
  TO authenticated
  WITH CHECK (get_user_workspace_role(workspace_id) IN ('owner', 'admin'));

CREATE POLICY "Invited users can update their invitation"
  ON workspace_invitations FOR UPDATE
  TO authenticated
  USING (email = auth.jwt()->>'email');

-- RLS Policies: Workspace Usage
CREATE POLICY "Users can view usage for their workspaces"
  ON workspace_usage FOR SELECT
  TO authenticated
  USING (user_has_workspace_access(workspace_id));

CREATE POLICY "Service role can manage usage"
  ON workspace_usage FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);