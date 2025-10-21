import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Save, FolderOpen, Clock, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Overlay, AspectRatio } from "@/lib/video-editor/types";
import { formatDistanceToNow } from "date-fns";

interface ProjectManagerProps {
  currentProjectId: string | null;
  currentProjectName: string;
  overlays: Overlay[];
  aspectRatio: AspectRatio;
  onProjectNameChange: (name: string) => void;
  onSave: (projectId: string) => void;
  onLoad: (projectId: string, data: ProjectData) => void;
  onNew: () => void;
}

export interface ProjectData {
  project_name: string;
  timeline_data: {
    overlays: Overlay[];
    aspectRatio: AspectRatio;
  };
  duration_seconds: number;
}

export const ProjectManager: React.FC<ProjectManagerProps> = ({
  currentProjectId,
  currentProjectName,
  overlays,
  aspectRatio,
  onProjectNameChange,
  onSave,
  onLoad,
  onNew,
}) => {
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [projectName, setProjectName] = useState(currentProjectName);
  const [savedProjects, setSavedProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Load saved projects list
  const loadProjects = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("video_projects")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setSavedProjects(data || []);
    } catch (error) {
      console.error("Error loading projects:", error);
      toast.error("Failed to load projects");
    }
  };

  useEffect(() => {
    if (loadDialogOpen) {
      loadProjects();
    }
  }, [loadDialogOpen]);

  useEffect(() => {
    setProjectName(currentProjectName);
  }, [currentProjectName]);

  // Save current project
  const handleSave = async () => {
    if (!projectName.trim()) {
      toast.error("Please enter a project name");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in to save projects");
        return;
      }

      // Calculate duration
      const maxEnd = overlays.reduce((max, o) => 
        Math.max(max, o.from + o.durationInFrames), 0
      );
      const durationSeconds = Math.ceil(maxEnd / 30);

      const projectData = {
        user_id: user.id,
        project_name: projectName,
        timeline_data: {
          overlays,
          aspectRatio,
        },
        duration_seconds: durationSeconds,
        status: "draft",
      };

      let savedProjectId = currentProjectId;

      if (currentProjectId) {
        // Update existing project
        const { error } = await supabase
          .from("video_projects")
          .update({
            ...projectData,
            updated_at: new Date().toISOString(),
          })
          .eq("id", currentProjectId);

        if (error) throw error;
        toast.success("Project updated successfully");
      } else {
        // Create new project
        const { data, error } = await supabase
          .from("video_projects")
          .insert(projectData)
          .select()
          .single();

        if (error) throw error;
        savedProjectId = data.id;
        toast.success("Project saved successfully");
      }

      onProjectNameChange(projectName);
      onSave(savedProjectId);
      setSaveDialogOpen(false);
    } catch (error) {
      console.error("Error saving project:", error);
      toast.error("Failed to save project");
    } finally {
      setLoading(false);
    }
  };

  // Load selected project
  const handleLoadProject = async (projectId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("video_projects")
        .select("*")
        .eq("id", projectId)
        .single();

      if (error) throw error;

      const projectData: ProjectData = {
        project_name: data.project_name,
        timeline_data: data.timeline_data as { overlays: Overlay[]; aspectRatio: AspectRatio },
        duration_seconds: data.duration_seconds,
      };

      onLoad(projectId, projectData);
      setProjectName(data.project_name);
      toast.success(`Loaded project: ${data.project_name}`);
      setLoadDialogOpen(false);
    } catch (error) {
      console.error("Error loading project:", error);
      toast.error("Failed to load project");
    } finally {
      setLoading(false);
    }
  };

  // Delete project
  const handleDeleteProject = async (projectId: string, projectName: string) => {
    if (!confirm(`Delete project "${projectName}"?`)) return;

    try {
      const { error } = await supabase
        .from("video_projects")
        .delete()
        .eq("id", projectId);

      if (error) throw error;
      toast.success("Project deleted");
      loadProjects();
    } catch (error) {
      console.error("Error deleting project:", error);
      toast.error("Failed to delete project");
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* Save Button */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Project</DialogTitle>
            <DialogDescription>
              {currentProjectId 
                ? "Update your existing project" 
                : "Save your project to continue editing later"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="project-name">Project Name</Label>
              <Input
                id="project-name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="My awesome video"
              />
            </div>
            <div className="text-sm text-muted-foreground">
              {overlays.length} overlay{overlays.length !== 1 ? 's' : ''} • {aspectRatio} aspect ratio
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? "Saving..." : currentProjectId ? "Update" : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Load Button */}
      <Dialog open={loadDialogOpen} onOpenChange={setLoadDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <FolderOpen className="h-4 w-4 mr-2" />
            Load
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Load Project</DialogTitle>
            <DialogDescription>
              Select a project to load
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-96 pr-4">
            <div className="space-y-2">
              {savedProjects.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No saved projects yet
                </div>
              ) : (
                savedProjects.map((project) => (
                  <div
                    key={project.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent cursor-pointer"
                    onClick={() => handleLoadProject(project.id)}
                  >
                    <div className="flex-1">
                      <h4 className="font-medium">{project.project_name}</h4>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(project.updated_at), { addSuffix: true })}
                        </span>
                        <span>
                          {project.timeline_data?.overlays?.length || 0} overlays
                        </span>
                        <span>
                          {project.duration_seconds}s
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteProject(project.id, project.project_name);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* New Project Button */}
      <Button 
        variant="outline" 
        size="sm"
        onClick={onNew}
        title="New project (discards unsaved changes)"
      >
        New
      </Button>
    </div>
  );
};
