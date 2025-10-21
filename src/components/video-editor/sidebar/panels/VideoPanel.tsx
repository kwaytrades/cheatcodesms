import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Upload, Video as VideoIcon } from "lucide-react";
import { useEditorContext } from "@/contexts/video-editor/EditorContext";
import { OverlayType } from "@/lib/video-editor/types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const VideoPanel: React.FC = () => {
  const { addOverlay, currentFrame } = useEditorContext();
  const [url, setUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [contentVideos, setContentVideos] = useState<Array<{ name: string; url: string }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load content library videos
  React.useEffect(() => {
    loadContentVideos();
  }, []);

  const loadContentVideos = async () => {
    try {
      const { data, error } = await supabase.storage
        .from('content-videos')
        .list();

      if (error) throw error;

      const videos = await Promise.all(
        (data || []).map(async (file) => {
          const { data: urlData } = await supabase.storage
            .from('content-videos')
            .createSignedUrl(file.name, 3600);
          
          return {
            name: file.name,
            url: urlData?.signedUrl || '',
          };
        })
      );

      setContentVideos(videos.filter(v => v.url));
    } catch (error) {
      console.error('Error loading videos:', error);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileName = `${Date.now()}-${file.name}`;
      const { data, error } = await supabase.storage
        .from('content-videos')
        .upload(fileName, file);

      if (error) throw error;

      const { data: urlData } = await supabase.storage
        .from('content-videos')
        .createSignedUrl(fileName, 3600);

      if (urlData?.signedUrl) {
        addVideoOverlay(urlData.signedUrl);
        toast.success('Video uploaded successfully!');
        loadContentVideos();
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload video');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const addVideoOverlay = (videoUrl: string) => {
    addOverlay({
      id: Date.now(),
      type: OverlayType.VIDEO,
      src: videoUrl,
      content: "",
      from: currentFrame,
      durationInFrames: 150,
      left: 0,
      top: 0,
      width: 1920,
      height: 1080,
      row: 0,
      rotation: 0,
      isDragging: false,
      videoStartTime: 0,
      styles: {
        objectFit: "cover",
        opacity: 1,
      },
    });
  };

  const handleAddFromUrl = () => {
    if (!url) return;
    addVideoOverlay(url);
    setUrl("");
    toast.success('Video added to timeline');
  };

  return (
    <div className="p-4 space-y-4">
      <Tabs defaultValue="library">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="library">Library</TabsTrigger>
          <TabsTrigger value="upload">Upload</TabsTrigger>
          <TabsTrigger value="url">URL</TabsTrigger>
        </TabsList>

        <TabsContent value="library" className="space-y-2">
          <p className="text-sm text-muted-foreground">Select from content library</p>
          <div className="grid grid-cols-2 gap-2 max-h-[400px] overflow-auto">
            {contentVideos.length === 0 ? (
              <p className="col-span-2 text-center text-sm text-muted-foreground py-8">
                No videos in library. Upload one to get started!
              </p>
            ) : (
              contentVideos.map((video, idx) => (
                <button
                  key={idx}
                  onClick={() => addVideoOverlay(video.url)}
                  className="aspect-video bg-muted rounded-lg overflow-hidden hover:ring-2 hover:ring-primary transition-all group"
                >
                  <div className="w-full h-full flex items-center justify-center bg-muted">
                    <VideoIcon className="h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <p className="text-xs truncate p-1">{video.name}</p>
                </button>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="upload" className="space-y-4">
          <div>
            <Label>Upload Video File</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              className="w-full"
              disabled={uploading}
            >
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? 'Uploading...' : 'Choose Video File'}
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              Supports MP4, WebM, MOV formats
            </p>
          </div>
        </TabsContent>

        <TabsContent value="url" className="space-y-4">
          <div>
            <Label>Video URL</Label>
            <Input
              placeholder="https://example.com/video.mp4"
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
