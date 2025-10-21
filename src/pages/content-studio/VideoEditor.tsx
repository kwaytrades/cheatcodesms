import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AVCanvas } from "@webav/av-canvas";
import { Combinator, MP4Clip, OffscreenSprite, VisibleSprite, renderTxt2ImgBitmap, ImgClip } from "@webav/av-cliper";
import { VideoEditorCanvas } from "@/components/video-editor/VideoEditorCanvas";
import { VideoEditorTimeline } from "@/components/video-editor/VideoEditorTimeline";
import { VideoEditorControls } from "@/components/video-editor/VideoEditorControls";
import { VideoEditorToolbar } from "@/components/video-editor/VideoEditorToolbar";
import { TextOverlayDialog } from "@/components/video-editor/TextOverlayDialog";
import { ImageOverlayDialog } from "@/components/video-editor/ImageOverlayDialog";
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
  sprite?: VisibleSprite;
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
  const [showTextDialog, setShowTextDialog] = useState(false);
  const [showImageDialog, setShowImageDialog] = useState(false);
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

      setIsLoading(false);
    };

    initialize();
  }, [navigate]);

  // Load video into canvas when video data is provided and canvas is ready
  useEffect(() => {
    let mounted = true;
    
    const loadVideo = async () => {
      if (!videoData?.video_url) return;
      
      // Wait for canvas to be initialized
      if (!canvasRef.current) {
        await new Promise(resolve => setTimeout(resolve, 100));
        if (mounted) loadVideo();
        return;
      }

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
          return;
        }

        if (data?.signedUrl && mounted) {
          await loadVideoFromUrl(data.signedUrl);
        }
      } catch (error) {
        console.error('Error loading video:', error);
        if (mounted) {
          toast.error("Failed to load video. Please try again.");
        }
      }
    };

    loadVideo();
    
    return () => {
      mounted = false;
    };
  }, [videoData]);

  const loadVideoFromUrl = async (url: string) => {
    try {
      console.log('Loading video from URL:', url);
      
      if (!canvasRef.current) {
        console.error('Canvas not initialized');
        toast.error("Canvas not initialized");
        return;
      }

      console.log('Creating HTML5 video element...');
      // Use native HTML5 video element - works with all formats (MP4, WebM, MOV, etc.)
      const video = document.createElement('video');
      video.src = url;
      video.crossOrigin = 'anonymous';
      video.loop = false;
      video.muted = false;
      
      // Wait for video metadata to load
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => {
          console.log('Video metadata loaded - duration:', video.duration, 'size:', video.videoWidth, 'x', video.videoHeight);
          resolve();
        };
        video.onerror = (e) => {
          console.error('Video loading error:', e);
          reject(new Error('Failed to load video'));
        };
        // Trigger loading
        video.load();
      });
      
      // Create sprite from native video element
      console.log('Creating VisibleSprite from video element...');
      const sprite = new VisibleSprite(video as any);
      
      // Set sprite dimensions to match canvas
      sprite.rect.w = CANVAS_FORMATS[selectedFormat].width;
      sprite.rect.h = CANVAS_FORMATS[selectedFormat].height;
      sprite.rect.x = 0;
      sprite.rect.y = 0;
      
      console.log('Adding sprite to canvas...');
      await (canvasRef.current as any).addSprite(sprite);
      console.log('Sprite added successfully');
      
      // Add to clips
      const newClip: VideoClip = {
        id: `clip-${Date.now()}`,
        url,
        startTime: 0,
        duration: video.duration,
        track: clips.length,
        sprite,
      };
      
      setClips(prev => [...prev, newClip]);
      setDuration(prev => Math.max(prev, video.duration));
      toast.success("Video loaded successfully - click Play to start");
    } catch (error) {
      console.error('Error loading video from URL:', error);
      toast.error(`Failed to load video: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleSplitClip = () => {
    if (clips.length === 0) {
      toast.error("No clips to split");
      return;
    }

    // Find the clip at current time
    const clipToSplit = clips.find(
      clip => currentTime >= clip.startTime && currentTime < clip.startTime + clip.duration
    );

    if (!clipToSplit) {
      toast.error("No clip at current playhead position");
      return;
    }

    // Calculate split point relative to clip start
    const splitPoint = currentTime - clipToSplit.startTime;

    toast.info(`Split at ${splitPoint.toFixed(2)}s - Feature in development`);
  };

  const handleImportVideo = async (file: File) => {
    try {
      // Create object URL for the file
      const url = URL.createObjectURL(file);
      await loadVideoFromUrl(url);
    } catch (error) {
      console.error('Error importing video:', error);
      toast.error("Failed to import video");
    }
  };


  const handleFormatChange = (format: keyof typeof CANVAS_FORMATS) => {
    setSelectedFormat(format);
    setIsPlaying(false);
    // Note: Canvas will reinitialize automatically due to dependency change
  };

  const handleAddText = async (text: string, fontSize: number, color: string) => {
    try {
      if (!canvasRef.current) {
        toast.error("Canvas not initialized");
        return;
      }

      // Create text image bitmap
      const textBitmap = await renderTxt2ImgBitmap(
        text,
        `font-size:${fontSize}px; color: ${color}; font-weight: bold; text-shadow: 2px 2px 6px rgba(0,0,0,0.8);`
      );

      console.log('Text bitmap created:', textBitmap.width, 'x', textBitmap.height);

      // Create image clip and sprite
      const imgClip = new ImgClip(textBitmap);
      await imgClip.ready;
      
      const sprite = new VisibleSprite(imgClip);
      
      // Position in center
      sprite.rect.x = (CANVAS_FORMATS[selectedFormat].width - textBitmap.width) / 2;
      sprite.rect.y = (CANVAS_FORMATS[selectedFormat].height - textBitmap.height) / 2;
      sprite.rect.w = textBitmap.width;
      sprite.rect.h = textBitmap.height;
      sprite.zIndex = 100; // Put text on top

      console.log('Adding text sprite to canvas...');
      await (canvasRef.current as any).addSprite(sprite);
      console.log('Text sprite added');

      const newClip: VideoClip = {
        id: `text-${Date.now()}`,
        url: '',
        startTime: currentTime,
        duration: 5, // 5 seconds default
        track: clips.length,
        sprite,
      };

      setClips(prev => [...prev, newClip]);
      toast.success("Text overlay added");
    } catch (error) {
      console.error('Error adding text:', error);
      toast.error("Failed to add text overlay");
    }
  };

  const handleAddImage = async (imageUrl: string) => {
    try {
      if (!canvasRef.current) {
        toast.error("Canvas not initialized");
        return;
      }

      // Load image as bitmap
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const imgBitmap = await createImageBitmap(blob);

      console.log('Image bitmap created:', imgBitmap.width, 'x', imgBitmap.height);

      // Create image clip and sprite
      const imgClip = new ImgClip(imgBitmap);
      await imgClip.ready;
      
      const sprite = new VisibleSprite(imgClip);
      
      // Scale to fit canvas (max 30% of canvas size)
      const maxSize = Math.min(CANVAS_FORMATS[selectedFormat].width, CANVAS_FORMATS[selectedFormat].height) * 0.3;
      const scale = Math.min(maxSize / imgBitmap.width, maxSize / imgBitmap.height);
      sprite.rect.w = imgBitmap.width * scale;
      sprite.rect.h = imgBitmap.height * scale;
      
      // Position in center
      sprite.rect.x = (CANVAS_FORMATS[selectedFormat].width - sprite.rect.w) / 2;
      sprite.rect.y = (CANVAS_FORMATS[selectedFormat].height - sprite.rect.h) / 2;
      sprite.zIndex = 100; // Put image on top

      console.log('Adding image sprite to canvas...');
      await (canvasRef.current as any).addSprite(sprite);
      console.log('Image sprite added');

      const newClip: VideoClip = {
        id: `image-${Date.now()}`,
        url: imageUrl,
        startTime: currentTime,
        duration: 5, // 5 seconds default
        track: clips.length,
        sprite,
      };

      setClips(prev => [...prev, newClip]);
      toast.success("Image overlay added");
    } catch (error) {
      console.error('Error adding image:', error);
      toast.error("Failed to add image overlay");
    }
  };

  // Control playback with isPlaying state
  useEffect(() => {
    if (!canvasRef.current || clips.length === 0) return;

    const canvas = canvasRef.current as any;
    
    if (isPlaying) {
      console.log('Starting playback...');
      canvas.play?.().catch((err: Error) => {
        console.error('Playback error:', err);
        setIsPlaying(false);
      });
    } else {
      console.log('Pausing playback...');
      canvas.pause?.();
    }
  }, [isPlaying, clips.length]);

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
          onImportVideo={handleImportVideo}
          onAddText={() => setShowTextDialog(true)}
          onAddImage={() => setShowImageDialog(true)}
          onSplit={handleSplitClip}
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
          hasClips={clips.length > 0}
        />
        <VideoEditorTimeline
          clips={clips}
          currentTime={currentTime}
          duration={duration}
          onClipsChange={setClips}
          onTimeChange={setCurrentTime}
        />
      </div>

      {/* Dialogs */}
      <TextOverlayDialog
        open={showTextDialog}
        onOpenChange={setShowTextDialog}
        onAdd={handleAddText}
      />
      <ImageOverlayDialog
        open={showImageDialog}
        onOpenChange={setShowImageDialog}
        onAdd={handleAddImage}
      />
    </div>
  );
};

export default VideoEditor;
