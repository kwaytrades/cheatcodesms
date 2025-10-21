import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEditorContext } from "@/contexts/video-editor/EditorContext";
import { Overlay, OverlayType } from "@/lib/video-editor/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Upload, Link as LinkIcon, Loader2, Video } from "lucide-react";
import { toast } from "sonner";

export const VideoPanel: React.FC = () => {
  const { addOverlay, durationInFrames } = useEditorContext();
  const [videoUrl, setVideoUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  // Fetch videos from content_videos database table
  const { data: contentVideos, isLoading } = useQuery({
    queryKey: ['content-videos-library'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('content_videos')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Get signed URLs for each video
      const videosWithUrls = await Promise.all(
        data.map(async (video) => {
          const { data: signedData } = await supabase.storage
            .from('content-videos')
            .createSignedUrl(video.video_url, 3600);
          
          return {
            ...video,
            signedUrl: signedData?.signedUrl || video.video_url
          };
        })
      );
      
      return videosWithUrls;
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const fileName = `${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('content-videos')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get signed URL
      const { data: signedData } = await supabase.storage
        .from('content-videos')
        .createSignedUrl(fileName, 3600);

      if (!signedData) throw new Error("Failed to get signed URL");

      // Create database entry
      const { error: dbError } = await supabase
        .from('content_videos')
        .insert({
          user_id: user.id,
          video_url: fileName,
          file_size_bytes: file.size,
        });

      if (dbError) throw dbError;

      addVideoOverlay(signedData.signedUrl);
      toast.success("Video uploaded and added to timeline");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload video");
    } finally {
      setUploading(false);
    }
  };

  const addVideoOverlay = (url: string) => {
    const newOverlay: Overlay = {
      id: Date.now(),
      type: OverlayType.VIDEO,
      from: 0,
      durationInFrames: Math.min(300, durationInFrames), // 10 seconds at 30fps
      left: 0,
      top: 0,
      width: 1920,
      height: 1080,
      src: url,
      content: "Video",
      videoStartTime: 0,
      isDragging: false,
      rotation: 0,
      row: 0,
      styles: {
        volume: 1,
      },
    };
    addOverlay(newOverlay);
    toast.success("Video added to timeline");
  };

  const handleAddFromUrl = () => {
    if (!videoUrl.trim()) {
      toast.error("Please enter a video URL");
      return;
    }
    addVideoOverlay(videoUrl);
    setVideoUrl("");
  };

  const handleAddFromLibrary = (video: any) => {
    addVideoOverlay(video.signedUrl);
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="library" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="library">Library</TabsTrigger>
          <TabsTrigger value="upload">Upload</TabsTrigger>
          <TabsTrigger value="url">URL</TabsTrigger>
        </TabsList>

        <TabsContent value="library" className="space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : contentVideos && contentVideos.length > 0 ? (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {contentVideos.map((video) => (
                <Card
                  key={video.id}
                  className="p-3 hover:bg-accent cursor-pointer transition-colors"
                  onClick={() => handleAddFromLibrary(video)}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-none w-16 h-16 bg-muted rounded flex items-center justify-center">
                      <Video className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">Video {video.take_number}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{new Date(video.created_at).toLocaleDateString()}</span>
                        {video.duration_seconds && (
                          <span>• {Math.floor(video.duration_seconds / 60)}:{(video.duration_seconds % 60).toString().padStart(2, '0')}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Video className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No videos in library</p>
              <p className="text-xs mt-1">Record videos in the Video Recorder</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="upload" className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="video-upload">Upload Video File</Label>
            <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary transition-colors">
              <input
                id="video-upload"
                type="file"
                accept="video/*"
                onChange={handleFileUpload}
                className="hidden"
                disabled={uploading}
              />
              <label htmlFor="video-upload" className="cursor-pointer">
                {uploading ? (
                  <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin text-primary" />
                ) : (
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                )}
                <p className="text-sm font-medium">
                  {uploading ? "Uploading..." : "Click to upload video"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">MP4, MOV, or WebM</p>
              </label>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="url" className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="video-url">Video URL</Label>
            <Input
              id="video-url"
              placeholder="https://example.com/video.mp4"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddFromUrl()}
            />
          </div>
          <Button onClick={handleAddFromUrl} className="w-full">
            <LinkIcon className="h-4 w-4 mr-2" />
            Add from URL
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
};
