import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AVCanvas } from "@webav/av-canvas";
import { Combinator, MP4Clip, OffscreenSprite } from "@webav/av-cliper";
import { VideoEditorCanvas } from "@/components/video-editor/VideoEditorCanvas";
import { VideoEditorTimeline } from "@/components/video-editor/VideoEditorTimeline";
import { VideoEditorControls } from "@/components/video-editor/VideoEditorControls";
import { VideoEditorToolbar } from "@/components/video-editor/VideoEditorToolbar";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Monitor } from "lucide-react";

export const CANVAS_FORMATS = {
  youtube: { name: "YouTube (16:9)", width: 1920, height: 1080 },
  tiktok: { name: "TikTok (9:16)", width: 1080, height: 1920 },
  instagram: { name: "Instagram Square (1:1)", width: 1080, height: 1080 },
  instagramStory: { name: "Instagram Story (9:16)", width: 1080, height: 1920 },
  facebook: { name: "Facebook (16:9)", width: 1920, height: 1080 },
  twitter: { name: "Twitter (16:9)", width: 1280, height: 720 },
  linkedin: { name: "LinkedIn (1:1)", width: 1080, height: 1080 },
};

export interface VideoClip {
  id: string;
  url: string;
  startTime: number;
  duration: number;
  track: number;
  sprite?: OffscreenSprite;
}

const VideoEditor = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const videoData = location.state?.video;
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFormat, setSelectedFormat] = useState<keyof typeof CANVAS_FORMATS>("youtube");
  const [clips, setClips] = useState<VideoClip[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const canvasRef = useRef<AVCanvas | null>(null);
  const combinatorRef = useRef<Combinator | null>(null);

  useEffect(() => {
    const initialize = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in to use the video editor");
        navigate("/auth");
        return;
      }

      // Load video if provided
      if (videoData?.video_url) {
        try {
          const storagePath = videoData.video_url.includes('content-videos/') 
            ? videoData.video_url.split('content-videos/')[1]
            : videoData.video_url;

          const { data, error } = await supabase.storage
            .from('content-videos')
            .createSignedUrl(storagePath, 3600);

          if (error) {
            console.error('Error getting signed URL:', error);
            toast.error("Failed to load video");
          } else if (data?.signedUrl) {
            // Add video as first clip
            const newClip: VideoClip = {
              id: `clip-${Date.now()}`,
              url: data.signedUrl,
              startTime: 0,
              duration: 0, // Will be set after loading
              track: 0,
            };
            setClips([newClip]);
            toast.success("Video loaded successfully");
          }
        } catch (error) {
          console.error('Error loading video:', error);
          toast.error("Failed to load video");
        }
      }

      setIsLoading(false);
    };

    initialize();
  }, [navigate, videoData]);

  const handleFormatChange = (format: keyof typeof CANVAS_FORMATS) => {
    setSelectedFormat(format);
    // Reinitialize canvas with new dimensions
    if (canvasRef.current) {
      canvasRef.current = null;
    }
  };

  const handleExport = async () => {
    if (clips.length === 0) {
      toast.error("No clips to export");
      return;
    }

    setIsExporting(true);
    try {
      // Use AVCanvas to create combinator for export
      if (!canvasRef.current) {
        toast.error("Canvas not initialized");
        return;
      }

      const combinator = await canvasRef.current.createCombinator();
      const outputStream = await combinator.output();
      
      // Convert stream to blob
      const chunks: Uint8Array[] = [];
      const reader = outputStream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      
      const blob = new Blob(chunks as BlobPart[], { type: 'video/mp4' });
      
      // Upload to Supabase
      const fileName = `export-${Date.now()}.mp4`;
      const { data, error } = await supabase.storage
        .from('content-videos')
        .upload(fileName, blob);

      if (error) throw error;

      toast.success("Video exported successfully!");
      
      // Download file
      const { data: urlData } = await supabase.storage
        .from('content-videos')
        .createSignedUrl(fileName, 3600);
      
      if (urlData?.signedUrl) {
        const a = document.createElement('a');
        a.href = urlData.signedUrl;
        a.download = fileName;
        a.click();
      }
    } catch (error) {
      console.error('Export error:', error);
      toast.error("Failed to export video");
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading video editor...</p>
        </div>
      </div>
    );
  }

  const currentFormat = CANVAS_FORMATS[selectedFormat];

  return (
    <div className="h-screen w-full bg-background flex flex-col overflow-hidden">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between gap-4 p-4 border-b border-border bg-card">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Monitor className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm font-medium">Canvas Format:</span>
          </div>
          <Select value={selectedFormat} onValueChange={handleFormatChange}>
            <SelectTrigger className="w-[250px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CANVAS_FORMATS).map(([key, format]) => (
                <SelectItem key={key} value={key}>
                  {format.name} - {format.width}x{format.height}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">
            {currentFormat.width} × {currentFormat.height}px
          </span>
        </div>
        
        <VideoEditorToolbar 
          onExport={handleExport}
          isExporting={isExporting}
          clips={clips}
        />
      </div>

      {/* Main Editor Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas Preview */}
        <VideoEditorCanvas
          format={currentFormat}
          clips={clips}
          currentTime={currentTime}
          canvasRef={canvasRef}
        />
      </div>

      {/* Timeline & Controls */}
      <div className="border-t border-border bg-card">
        <VideoEditorControls
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          onPlayPause={() => setIsPlaying(!isPlaying)}
          onSeek={setCurrentTime}
        />
        <VideoEditorTimeline
          clips={clips}
          currentTime={currentTime}
          duration={duration}
          onClipsChange={setClips}
          onTimeChange={setCurrentTime}
        />
      </div>
    </div>
  );
};

export default VideoEditor;
