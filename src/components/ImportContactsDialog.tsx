import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

interface MondayBoard {
  id: string;
  name: string;
}

interface ImportContactsDialogProps {
  onImportComplete: () => void;
}

export const ImportContactsDialog = ({ onImportComplete }: ImportContactsDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [boards, setBoards] = useState<MondayBoard[]>([]);
  const [selectedBoardIds, setSelectedBoardIds] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  useEffect(() => {
    if (open && boards.length === 0) {
      fetchBoards();
    }
  }, [open]);

  const fetchBoards = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('monday-integration', {
        body: { action: 'list_boards' }
      });

      if (error) throw error;

      if (data?.boards) {
        setBoards(data.boards);
      } else {
        toast.error("No boards found");
      }
    } catch (error: any) {
      if (error.message?.includes('MONDAY_API_KEY')) {
        toast.error("Monday.com API key not configured");
      } else {
        toast.error("Failed to fetch boards");
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleBoard = (boardId: string) => {
    setSelectedBoardIds(prev =>
      prev.includes(boardId)
        ? prev.filter(id => id !== boardId)
        : [...prev, boardId]
    );
  };

  const addTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleImport = async () => {
    if (selectedBoardIds.length === 0) {
      toast.error("Please select at least one board");
      return;
    }

    setImporting(true);
    try {
      // First, sync contacts from Monday.com
      const { data: syncData, error: syncError } = await supabase.functions.invoke('sync-contacts', {
        body: { boardIds: selectedBoardIds }
      });

      if (syncError) throw syncError;

      // If tags are specified, update the imported contacts with tags
      if (tags.length > 0) {
        const { data: contacts, error: contactsError } = await supabase
          .from('contacts')
          .select('id, tags')
          .in('monday_board_id', selectedBoardIds);

        if (contactsError) throw contactsError;

        // Update each contact with the new tags
        const updates = contacts.map(contact => ({
          id: contact.id,
          tags: [...(contact.tags || []), ...tags].filter((tag, index, self) => 
            self.indexOf(tag) === index // Remove duplicates
          )
        }));

        for (const update of updates) {
          await supabase
            .from('contacts')
            .update({ tags: update.tags })
            .eq('id', update.id);
        }
      }

      toast.success(`Successfully imported ${syncData.total} contacts${tags.length > 0 ? ' with tags' : ''}`);
      setOpen(false);
      setSelectedBoardIds([]);
      setTags([]);
      onImportComplete();
    } catch (error: any) {
      console.error('Import error:', error);
      if (error.message?.includes('MONDAY_API_KEY')) {
        toast.error("Monday.com API key not configured. Please add it in settings.");
      } else {
        toast.error("Failed to import contacts");
      }
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Download className="h-4 w-4" />
          Import from Monday
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-background max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Contacts from Monday.com</DialogTitle>
          <DialogDescription>
            Select boards to import and optionally add tags to segment these contacts.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Select Boards</Label>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : boards.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <p>No boards found. Please check your API configuration.</p>
              </div>
            ) : (
              <ScrollArea className="h-[200px] rounded-md border bg-background p-4">
                <div className="space-y-3">
                  {boards.map((board) => (
                    <div key={board.id} className="flex items-center space-x-3">
                      <Checkbox
                        id={board.id}
                        checked={selectedBoardIds.includes(board.id)}
                        onCheckedChange={() => toggleBoard(board.id)}
                      />
                      <label
                        htmlFor={board.id}
                        className="flex-1 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {board.name}
                      </label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="tags">Tags (Optional)</Label>
            <div className="flex gap-2">
              <Input
                id="tags"
                placeholder="Enter tag name"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag();
                  }
                }}
              />
              <Button type="button" size="sm" onClick={addTag}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    {tag}
                    <X
                      className="h-3 w-3 cursor-pointer"
                      onClick={() => removeTag(tag)}
                    />
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleImport} 
            disabled={selectedBoardIds.length === 0 || importing}
          >
            {importing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              'Import Contacts'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};