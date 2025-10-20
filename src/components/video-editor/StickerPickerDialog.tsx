import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

interface StickerPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (sticker: string) => void;
}

const stickerCategories = {
  emojis: {
    label: 'Emojis',
    items: ['😂', '🔥', '💯', '👀', '❤️', '✨', '🎉', '👍', '💪', '🙌', '👏', '🤔', '😍', '🥳', '😎', '🤩', '😱', '😭', '💀', '👻', '💩', '🤡', '🤠', '🥸', '🤓'],
  },
  arrows: {
    label: 'Arrows',
    items: ['➡️', '⬅️', '⬆️', '⬇️', '↗️', '↘️', '↙️', '↖️', '⤴️', '⤵️', '🔄', '🔁', '🔀', '↪️', '↩️'],
  },
  shapes: {
    label: 'Shapes',
    items: ['⭐', '✨', '💫', '⚡', '💥', '🔥', '❤️', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '🟤'],
  },
  reactions: {
    label: 'Reactions',
    items: ['👍', '👎', '👌', '✌️', '🤞', '🤘', '🤙', '👊', '✊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏'],
  },
};

export const StickerPickerDialog = ({ open, onOpenChange, onSelect }: StickerPickerDialogProps) => {
  const handleSelect = (sticker: string) => {
    onSelect(sticker);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Choose a Sticker</DialogTitle>
          <DialogDescription>
            Select an emoji, arrow, shape, or reaction to add to your video
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="emojis" className="w-full">
          <TabsList className="grid grid-cols-4 w-full">
            {Object.entries(stickerCategories).map(([key, category]) => (
              <TabsTrigger key={key} value={key}>
                {category.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {Object.entries(stickerCategories).map(([key, category]) => (
            <TabsContent key={key} value={key}>
              <ScrollArea className="h-[300px] w-full">
                <div className="grid grid-cols-8 gap-2 p-2">
                  {category.items.map((sticker, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      className="h-16 w-16 text-3xl hover:scale-110 transition-transform"
                      onClick={() => handleSelect(sticker)}
                    >
                      {sticker}
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
