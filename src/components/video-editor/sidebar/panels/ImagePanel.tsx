import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Upload } from "lucide-react";
import { useEditorContext } from "@/contexts/video-editor/EditorContext";
import { OverlayType } from "@/lib/video-editor/types";
import { toast } from "sonner";

export const ImagePanel: React.FC = () => {
  const { addOverlay, currentFrame } = useEditorContext();
  const [url, setUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const reader = new FileReader();
    
    reader.onload = (event) => {
      const imageUrl = event.target?.result as string;
      addImageOverlay(imageUrl);
      toast.success('Image uploaded successfully!');
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };

    reader.onerror = () => {
      toast.error('Failed to upload image');
      setUploading(false);
    };

    reader.readAsDataURL(file);
  };

  const addImageOverlay = (imageUrl: string) => {
    addOverlay({
      id: Date.now(),
      type: OverlayType.IMAGE,
      src: imageUrl,
      from: currentFrame,
      durationInFrames: 90,
      left: 100,
      top: 100,
      width: 400,
      height: 300,
      row: 1,
      rotation: 0,
      isDragging: false,
      styles: {
        objectFit: "contain",
        opacity: 1,
      },
    });
  };

  const handleAddFromUrl = () => {
    if (!url) return;
    addImageOverlay(url);
    setUrl("");
    toast.success('Image added to timeline');
  };

  return (
    <div className="p-4 space-y-4">
      <Tabs defaultValue="upload">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upload">Upload</TabsTrigger>
          <TabsTrigger value="url">URL</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-4">
          <div>
            <Label>Upload Image File</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              className="w-full"
              disabled={uploading}
            >
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? 'Uploading...' : 'Choose Image File'}
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              Supports JPG, PNG, GIF, WebP formats
            </p>
          </div>
        </TabsContent>

        <TabsContent value="url" className="space-y-4">
          <div>
            <Label>Image URL</Label>
            <Input
              placeholder="https://example.com/image.jpg"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
          <Button onClick={handleAddFromUrl} className="w-full" disabled={!url}>
            <Plus className="h-4 w-4 mr-2" />
            Add from URL
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
};
