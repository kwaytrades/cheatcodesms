import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Workspace,
  WorkspaceWithMember,
  Organization,
  WorkspaceRole,
  OrganizationRole,
  Profile,
} from "@/types/multi-tenancy";

interface WorkspaceContextType {
  currentWorkspace: Workspace | null;
  workspaces: WorkspaceWithMember[];
  organization: Organization | null;
  profile: Profile | null;
  workspaceRole: WorkspaceRole | null;
  organizationRole: OrganizationRole | null;
  isAgency: boolean;
  isLoading: boolean;
  switchWorkspace: (workspaceId: string) => Promise<void>;
  refreshWorkspaces: () => Promise<void>;
  canManageWorkspace: boolean;
  canManageOrganization: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceWithMember[]>([]);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [workspaceRole, setWorkspaceRole] = useState<WorkspaceRole | null>(null);
  const [organizationRole, setOrganizationRole] = useState<OrganizationRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error) {
      console.error("Error loading profile:", error);
      return null;
    }

    const profile: Profile = {
      ...data,
      preferences: (data.preferences as Record<string, any>) || {},
    };

    setProfile(profile);
    return profile;
  };

  const loadWorkspaces = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get all workspaces user has access to
    const { data: memberData, error: memberError } = await supabase
      .from("workspace_members")
      .select(`
        *,
        workspace:workspaces(
          *,
          organization:organizations(*)
        )
      `)
      .eq("user_id", user.id);

    if (memberError) {
      console.error("Error loading workspaces:", memberError);
      return;
    }

    const workspacesWithDetails = memberData
      ?.map((m: any) => ({
        ...m.workspace,
        member: {
          id: m.id,
          workspace_id: m.workspace_id,
          user_id: m.user_id,
          role: m.role,
          created_at: m.created_at,
        },
      }))
      .filter((w: any) => w.id) || [];

    setWorkspaces(workspacesWithDetails);

    return workspacesWithDetails;
  };

  const setWorkspaceContext = async (workspace: Workspace) => {
    setCurrentWorkspace(workspace);

    // Load organization
    const { data: orgData } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", workspace.organization_id)
      .single();

    if (orgData) {
      const org: Organization = {
        ...orgData,
        plan_type: orgData.plan_type as 'starter' | 'professional' | 'agency',
        branding: (orgData.branding as any) || {},
        settings: (orgData.settings as Record<string, any>) || {},
      };
      setOrganization(org);
    }

    // Load workspace role
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: memberData } = await supabase
        .from("workspace_members")
        .select("role")
        .eq("workspace_id", workspace.id)
        .eq("user_id", user.id)
        .single();

      if (memberData) {
        setWorkspaceRole(memberData.role);
      }

      // Load organization role
      const { data: orgMemberData } = await supabase
        .from("organization_members")
        .select("role")
        .eq("organization_id", workspace.organization_id)
        .eq("user_id", user.id)
        .single();

      if (orgMemberData) {
        setOrganizationRole(orgMemberData.role);
      }
    }
  };

  const switchWorkspace = async (workspaceId: string) => {
    try {
      const workspace = workspaces.find((w) => w.id === workspaceId);
      if (!workspace) {
        toast.error("Workspace not found");
        return;
      }

      // Update profile's current workspace
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("profiles")
          .update({ current_workspace_id: workspaceId })
          .eq("id", user.id);
      }

      await setWorkspaceContext(workspace);
      toast.success(`Switched to ${workspace.name}`);
    } catch (error) {
      console.error("Error switching workspace:", error);
      toast.error("Failed to switch workspace");
    }
  };

  const refreshWorkspaces = async () => {
    await loadWorkspaces();
  };

  const initializeWorkspace = async () => {
    setIsLoading(true);
    try {
      const profileData = await loadProfile();
      const workspacesData = await loadWorkspaces();

      if (!workspacesData || workspacesData.length === 0) {
        // No workspaces - user needs to create or join one
        setIsLoading(false);
        return;
      }

      // Set current workspace
      let targetWorkspace = workspacesData[0];
      
      if (profileData?.current_workspace_id) {
        const savedWorkspace = workspacesData.find(
          (w: any) => w.id === profileData.current_workspace_id
        );
        if (savedWorkspace) {
          targetWorkspace = savedWorkspace;
        }
      }

      await setWorkspaceContext(targetWorkspace);
    } catch (error) {
      console.error("Error initializing workspace:", error);
      toast.error("Failed to load workspace data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    initializeWorkspace();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      initializeWorkspace();
    });

    return () => subscription.unsubscribe();
  }, []);

  const canManageWorkspace = workspaceRole === 'owner' || workspaceRole === 'admin';
  const canManageOrganization = organizationRole === 'owner' || organizationRole === 'admin';
  const isAgency = organization?.is_agency || false;

  const value: WorkspaceContextType = {
    currentWorkspace,
    workspaces,
    organization,
    profile,
    workspaceRole,
    organizationRole,
    isAgency,
    isLoading,
    switchWorkspace,
    refreshWorkspaces,
    canManageWorkspace,
    canManageOrganization,
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
}
