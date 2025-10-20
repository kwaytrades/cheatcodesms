import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TagsManagerProps {
  tags?: string[];
}

export const TagsManager = ({ tags }: TagsManagerProps) => {
  const { id } = useParams<{ id: string }>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [saving, setSaving] = useState(false);
  const tagList = tags || [];

  const handleAddTag = async () => {
    if (!newTag.trim() || !id) return;
    
    setSaving(true);
    try {
      const updatedTags = [...tagList, newTag.trim()];
      
      const { error } = await supabase
        .from("contacts")
        .update({ tags: updatedTags })
        .eq("id", id);
      
      if (error) throw error;
      toast.success("Tag added");
      setNewTag("");
      setDialogOpen(false);
      window.location.reload();
    } catch (error: any) {
      toast.error("Failed to add tag");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    if (!id) return;
    
    try {
      const updatedTags = tagList.filter(tag => tag !== tagToRemove);
      
      const { error } = await supabase
        .from("contacts")
        .update({ tags: updatedTags })
        .eq("id", id);
      
      if (error) throw error;
      toast.success("Tag removed");
      window.location.reload();
    } catch (error: any) {
      toast.error("Failed to remove tag");
    }
  };
  
  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">🏷️ Tags</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap gap-1">
            {tagList.map((tag, i) => (
              <Badge key={i} variant="secondary" className="text-xs group cursor-pointer hover:bg-secondary/80">
                {tag}
                <X 
                  className="h-3 w-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" 
                  onClick={() => handleRemoveTag(tag)}
                />
              </Badge>
            ))}
            {tagList.length === 0 && (
              <p className="text-sm text-muted-foreground">No tags yet</p>
            )}
          </div>
          <Button variant="outline" size="sm" className="w-full" onClick={() => setDialogOpen(true)}>
            <Plus className="h-3 w-3 mr-1" />
            Add Tag
          </Button>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Tag</DialogTitle>
            <DialogDescription>Add a new tag to this contact</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tag Name</Label>
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="e.g., VIP, High Priority..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newTag.trim()) {
                    handleAddTag();
                  }
                }}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleAddTag} disabled={saving || !newTag.trim()}>
                {saving ? "Adding..." : "Add Tag"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
