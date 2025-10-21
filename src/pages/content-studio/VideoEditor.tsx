import { TimelineProvider, INITIAL_TIMELINE_DATA } from "@twick/timeline";
import { LivePlayerProvider } from "@twick/live-player";
import { TwickStudio } from "@twick/studio";
import "@twick/studio/dist/studio.css";
import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Monitor } from "lucide-react";

const CANVAS_FORMATS = {
  youtube: { name: "YouTube (16:9)", width: 1920, height: 1080 },
  tiktok: { name: "TikTok (9:16)", width: 1080, height: 1920 },
  instagram: { name: "Instagram Square (1:1)", width: 1080, height: 1080 },
  instagramStory: { name: "Instagram Story (9:16)", width: 1080, height: 1920 },
  facebook: { name: "Facebook (16:9)", width: 1920, height: 1080 },
  twitter: { name: "Twitter (16:9)", width: 1280, height: 720 },
  linkedin: { name: "LinkedIn (1:1)", width: 1080, height: 1080 },
};

const VideoEditor = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const videoData = location.state?.video;
  const [isLoading, setIsLoading] = useState(true);
  const [projectData, setProjectData] = useState(INITIAL_TIMELINE_DATA);
  const [selectedFormat, setSelectedFormat] = useState<keyof typeof CANVAS_FORMATS>("youtube");
  const [showFormatSelector, setShowFormatSelector] = useState(true);

  useEffect(() => {
    const initialize = async () => {
      // Check authentication
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
            toast.success("Video loaded successfully");
            // Update project data with video and selected canvas dimensions
            setProjectData({
              ...INITIAL_TIMELINE_DATA,
              // Add video source or other configuration here
            });
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

  // Update project data when format changes
  useEffect(() => {
    setProjectData(prev => ({
      ...prev,
      // Update with selected format dimensions if needed
    }));
  }, [selectedFormat]);

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
      {/* Format Selector Bar */}
      <div className="flex items-center gap-4 p-4 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <Monitor className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm font-medium">Canvas Format:</span>
        </div>
        <Select value={selectedFormat} onValueChange={(value) => setSelectedFormat(value as keyof typeof CANVAS_FORMATS)}>
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

      {/* Editor Container - Fixed height to fit screen */}
      <div className="flex-1 overflow-hidden">
        <TimelineProvider 
          contextId="twick-video-editor" 
          initialData={projectData}
        >
          <LivePlayerProvider>
            <TwickStudio />
          </LivePlayerProvider>
        </TimelineProvider>
      </div>
    </div>
  );
};

export default VideoEditor;
