import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";

interface TagsManagerProps {
  tags?: string[];
}

export const TagsManager = ({ tags }: TagsManagerProps) => {
  const tagList = tags || [];
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">🏷️ Tags</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex flex-wrap gap-1">
          {tagList.map((tag, i) => (
            <Badge key={i} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
          {tagList.length === 0 && (
            <p className="text-sm text-muted-foreground">No tags yet</p>
          )}
        </div>
        <Button variant="outline" size="sm" className="w-full">
          <Plus className="h-3 w-3 mr-1" />
          Add Tag
        </Button>
      </CardContent>
    </Card>
  );
};
