// Multi-Tenancy Types

export type OrganizationRole = 'owner' | 'admin' | 'member';
export type WorkspaceRole = 'owner' | 'admin' | 'manager' | 'viewer';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan_type: 'starter' | 'professional' | 'agency';
  is_agency: boolean;
  parent_organization_id: string | null;
  settings: Record<string, any>;
  branding: {
    logo_url?: string | null;
    primary_color?: string;
    custom_domain?: string | null;
    company_name?: string | null;
  };
  created_at: string;
  updated_at: string;
}

export interface Workspace {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  settings: Record<string, any>;
  limits: {
    contacts: number;
    campaigns: number;
    messages_per_month: number;
    storage_mb: number;
  };
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  current_workspace_id: string | null;
  preferences: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrganizationRole;
  created_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  created_at: string;
}

export interface WorkspaceInvitation {
  id: string;
  workspace_id: string;
  email: string;
  role: WorkspaceRole;
  invited_by: string;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

export interface WorkspaceUsage {
  id: string;
  workspace_id: string;
  period_start: string;
  period_end: string;
  contacts_count: number;
  messages_sent: number;
  campaigns_active: number;
  storage_used_mb: number;
  created_at: string;
}

// Helper type for workspace with organization details
export interface WorkspaceWithOrganization extends Workspace {
  organization: Organization;
}

// Helper type for workspace with member details
export interface WorkspaceWithMember extends Workspace {
  member: WorkspaceMember;
  organization: Organization;
}
