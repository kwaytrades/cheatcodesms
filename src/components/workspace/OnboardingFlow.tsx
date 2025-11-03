import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function OnboardingFlow() {
  const [isLoading, setIsLoading] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [inviteToken, setInviteToken] = useState("");
  const navigate = useNavigate();

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  };

  const handleCreateOrganization = async () => {
    if (!orgName || !workspaceName) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Create organization
      const { data: org, error: orgError } = await supabase
        .from("organizations")
        .insert({
          name: orgName,
          slug: generateSlug(orgName),
          plan_type: "starter",
        })
        .select()
        .single();

      if (orgError) throw orgError;

      // Add user as organization owner
      const { error: orgMemberError } = await supabase
        .from("organization_members")
        .insert({
          organization_id: org.id,
          user_id: user.id,
          role: "owner",
        });

      if (orgMemberError) throw orgMemberError;

      // Create default workspace
      const { data: workspace, error: workspaceError } = await supabase
        .from("workspaces")
        .insert({
          organization_id: org.id,
          name: workspaceName,
          slug: generateSlug(workspaceName),
        })
        .select()
        .single();

      if (workspaceError) throw workspaceError;

      // Add user as workspace owner
      const { error: workspaceMemberError } = await supabase
        .from("workspace_members")
        .insert({
          workspace_id: workspace.id,
          user_id: user.id,
          role: "owner",
        });

      if (workspaceMemberError) throw workspaceMemberError;

      // Update profile with current workspace
      await supabase
        .from("profiles")
        .update({ current_workspace_id: workspace.id })
        .eq("id", user.id);

      toast.success("Organization created successfully!");
      navigate("/");
      window.location.reload(); // Reload to refresh workspace context
    } catch (error: any) {
      console.error("Error creating organization:", error);
      toast.error(error.message || "Failed to create organization");
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinWorkspace = async () => {
    if (!inviteToken) {
      toast.error("Please enter an invitation code");
      return;
    }

    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Find invitation
      const { data: invitation, error: inviteError } = await supabase
        .from("workspace_invitations")
        .select("*, workspace:workspaces(id, name, organization_id)")
        .eq("token", inviteToken)
        .eq("email", user.email)
        .is("accepted_at", null)
        .single();

      if (inviteError || !invitation) {
        throw new Error("Invalid or expired invitation");
      }

      // Check if invitation is expired
      if (new Date(invitation.expires_at) < new Date()) {
        throw new Error("Invitation has expired");
      }

      const workspace = invitation.workspace as any;

      // Add user to workspace
      const { error: memberError } = await supabase
        .from("workspace_members")
        .insert({
          workspace_id: invitation.workspace_id,
          user_id: user.id,
          role: invitation.role,
        });

      if (memberError) throw memberError;

      // Add user to organization
      const { error: orgMemberError } = await supabase
        .from("organization_members")
        .insert({
          organization_id: workspace.organization_id,
          user_id: user.id,
          role: "member",
        });

      // Ignore if already a member
      if (orgMemberError && !orgMemberError.message.includes("duplicate")) {
        throw orgMemberError;
      }

      // Mark invitation as accepted
      await supabase
        .from("workspace_invitations")
        .update({ accepted_at: new Date().toISOString() })
        .eq("id", invitation.id);

      // Update profile with current workspace
      await supabase
        .from("profiles")
        .update({ current_workspace_id: invitation.workspace_id })
        .eq("id", user.id);

      toast.success(`Joined ${workspace.name}!`);
      navigate("/");
      window.location.reload(); // Reload to refresh workspace context
    } catch (error: any) {
      console.error("Error joining workspace:", error);
      toast.error(error.message || "Failed to join workspace");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Welcome to Cheat Code</CardTitle>
          <CardDescription>
            Create your organization or join an existing workspace
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="create">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="create">Create New</TabsTrigger>
              <TabsTrigger value="join">Join Existing</TabsTrigger>
            </TabsList>
            
            <TabsContent value="create" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="org-name">Organization Name</Label>
                <Input
                  id="org-name"
                  placeholder="Acme Inc."
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="workspace-name">Workspace Name</Label>
                <Input
                  id="workspace-name"
                  placeholder="Main Workspace"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                />
              </div>

              <Button
                onClick={handleCreateOrganization}
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? "Creating..." : "Create Organization"}
              </Button>
            </TabsContent>

            <TabsContent value="join" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invite-code">Invitation Code</Label>
                <Input
                  id="invite-code"
                  placeholder="Enter your invitation code"
                  value={inviteToken}
                  onChange={(e) => setInviteToken(e.target.value)}
                />
              </div>

              <Button
                onClick={handleJoinWorkspace}
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? "Joining..." : "Join Workspace"}
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
