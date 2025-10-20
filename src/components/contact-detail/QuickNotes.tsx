import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";

interface QuickNotesProps {
  notes?: string;
  onSave?: (notes: string) => void;
}

export const QuickNotes = ({ notes: initialNotes = "", onSave }: QuickNotesProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [notes, setNotes] = useState(initialNotes);

  const handleSave = () => {
    onSave?.(notes);
    setIsEditing(false);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">📝 Quick Notes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {isEditing ? (
          <>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about this contact..."
              className="min-h-[80px] text-sm"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {notes || "No notes yet"}
            </p>
            <Button size="sm" variant="outline" className="w-full" onClick={() => setIsEditing(true)}>
              Edit Notes
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};
