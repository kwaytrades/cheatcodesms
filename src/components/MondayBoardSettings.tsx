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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings } from "lucide-react";
import { toast } from "sonner";

interface MondayBoardSettingsProps {
  onBoardsChanged: (boardIds: string[]) => void;
}

export const MondayBoardSettings = ({ onBoardsChanged }: MondayBoardSettingsProps) => {
  const [open, setOpen] = useState(false);
  const [boardIds, setBoardIds] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("monday_board_ids");
    if (stored) {
      setBoardIds(stored);
    }
  }, []);

  const handleSave = () => {
    const ids = boardIds
      .split(",")
      .map(id => id.trim())
      .filter(id => id.length > 0);
    
    if (ids.length === 0) {
      toast.error("Please enter at least one board ID");
      return;
    }

    localStorage.setItem("monday_board_ids", boardIds);
    onBoardsChanged(ids);
    setOpen(false);
    toast.success("Board settings saved");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings className="h-4 w-4" />
          Board Settings
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Monday.com Board Settings</DialogTitle>
          <DialogDescription>
            Enter the Monday.com board IDs you want to sync contacts from.
            You can enter multiple board IDs separated by commas.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="board-ids">Board IDs</Label>
            <Input
              id="board-ids"
              placeholder="e.g., 123456789, 987654321"
              value={boardIds}
              onChange={(e) => setBoardIds(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              To find board IDs, go to your Monday.com board and check the URL.
              The ID is the number after "/boards/" in the URL.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Settings</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
