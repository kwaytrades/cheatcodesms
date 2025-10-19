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
import { Settings, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface MondayBoard {
  id: string;
  name: string;
}

interface MondayBoardSettingsProps {
  onBoardsChanged: (boardIds: string[]) => void;
}

export const MondayBoardSettings = ({ onBoardsChanged }: MondayBoardSettingsProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [boards, setBoards] = useState<MondayBoard[]>([]);
  const [selectedBoardIds, setSelectedBoardIds] = useState<string[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem("monday_board_ids");
    if (stored) {
      setSelectedBoardIds(stored.split(",").map(id => id.trim()).filter(id => id.length > 0));
    }
  }, []);

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

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen && boards.length === 0) {
      fetchBoards();
    }
  };

  const toggleBoard = (boardId: string) => {
    setSelectedBoardIds(prev =>
      prev.includes(boardId)
        ? prev.filter(id => id !== boardId)
        : [...prev, boardId]
    );
  };

  const handleSave = () => {
    if (selectedBoardIds.length === 0) {
      toast.error("Please select at least one board");
      return;
    }

    localStorage.setItem("monday_board_ids", selectedBoardIds.join(","));
    onBoardsChanged(selectedBoardIds);
    setOpen(false);
    toast.success("Board settings saved");
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings className="h-4 w-4" />
          Board Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-background">
        <DialogHeader>
          <DialogTitle>Select Monday.com Boards</DialogTitle>
          <DialogDescription>
            Choose which Monday.com boards to sync contacts from.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : boards.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No boards found. Please check your API configuration.</p>
            </div>
          ) : (
            <ScrollArea className="h-[300px] rounded-md border bg-background p-4">
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
                      <span className="block text-xs text-muted-foreground mt-1">
                        ID: {board.id}
                      </span>
                    </label>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={selectedBoardIds.length === 0}>
            Save Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
