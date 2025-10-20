import { TimelineProvider, INITIAL_TIMELINE_DATA } from "@twick/timeline";
import { LivePlayerProvider } from "@twick/live-player";
import { TwickStudio } from "@twick/studio";
import "@twick/studio/dist/studio.css";
import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const VideoEditor = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const videoData = location.state?.video;
  const [isLoading, setIsLoading] = useState(true);
  const [projectData, setProjectData] = useState(INITIAL_TIMELINE_DATA);

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
            // TODO: Load video into Twick timeline
            // You can customize INITIAL_TIMELINE_DATA here with the video URL
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

  return (
    <div className="h-screen w-full bg-background">
      <TimelineProvider contextId="twick-video-editor" initialData={projectData}>
        <LivePlayerProvider>
          <TwickStudio />
        </LivePlayerProvider>
      </TimelineProvider>
    </div>
  );
};

export default VideoEditor;
