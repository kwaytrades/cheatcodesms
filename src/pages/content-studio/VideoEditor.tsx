import { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { VideoEditorToolbar } from "@/components/video-editor/VideoEditorToolbar";
import { VideoEditorCanvas } from "@/components/video-editor/VideoEditorCanvas";
import { VideoEditorControls } from "@/components/video-editor/VideoEditorControls";
import { VideoEditorTimeline } from "@/components/video-editor/VideoEditorTimeline";
import { TextOverlayDialog } from "@/components/video-editor/TextOverlayDialog";
import { ImageOverlayDialog } from "@/components/video-editor/ImageOverlayDialog";
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

// Canvas format presets
export const CANVAS_FORMATS = {
  youtube: { name: "YouTube (16:9)", width: 1920, height: 1080 },
  instagram_reel: { name: "Instagram Reel (9:16)", width: 1080, height: 1920 },
  instagram_feed: { name: "Instagram Feed (1:1)", width: 1080, height: 1080 },
  tiktok: { name: "TikTok (9:16)", width: 1080, height: 1920 },
  twitter: { name: "Twitter (16:9)", width: 1280, height: 720 },
};

export interface VideoClip {
  id: string;
  type: 'video' | 'audio' | 'text' | 'image';
  url: string;
  startTime: number;
  duration: number;
  track: number;
  
  // Video-specific
  trimStart?: number;
  trimEnd?: number;
  originalDuration?: number;
  
  // Transform for overlays
  transform?: {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    scale: number;
  };
  
  // Text-specific
  text?: string;
  textStyle?: {
    fontFamily: string;
    fontSize: number;
    color: string;
    fontWeight: string;
    textAlign: 'left' | 'center' | 'right';
  };
}

const VideoEditor = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [selectedFormat, setSelectedFormat] = useState<keyof typeof CANVAS_FORMATS>("youtube");
  const [clips, setClips] = useState<VideoClip[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  
  const [textDialogOpen, setTextDialogOpen] = useState(false);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  
  const ffmpegRef = useRef<FFmpeg | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      if (location.state?.videoUrl) {
        await loadVideoFromUrl(location.state.videoUrl);
      }
      
      setLoading(false);
    };

    checkAuth();
  }, [location.state, navigate]);

  const loadVideoFromUrl = async (url: string) => {
    try {
      toast.info("Loading video...");
      
      const path = url.split('/').pop();
      const { data, error } = await supabase.storage
        .from('content-videos')
        .createSignedUrl(path || '', 3600);

      if (error) throw error;

      const signedUrl = data.signedUrl;
      
      const video = document.createElement('video');
      video.src = signedUrl;
      video.crossOrigin = "anonymous";

      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error('Failed to load video'));
      });

      const newClip: VideoClip = {
        id: `video-${Date.now()}`,
        type: 'video',
        url: signedUrl,
        startTime: 0,
        duration: video.duration,
        track: 0,
        trimStart: 0,
        trimEnd: video.duration,
        originalDuration: video.duration,
      };

      setClips([newClip]);
      setDuration(video.duration);
      toast.success("Video loaded");
    } catch (error) {
      console.error('Error loading video:', error);
      toast.error("Failed to load video");
    }
  };

  const handleImportVideo = async (file: File) => {
    try {
      const url = URL.createObjectURL(file);
      
      const video = document.createElement('video');
      video.src = url;

      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error('Failed to load video'));
      });

      const newClip: VideoClip = {
        id: `video-${Date.now()}`,
        type: 'video',
        url,
        startTime: duration,
        duration: video.duration,
        track: 0,
        trimStart: 0,
        trimEnd: video.duration,
        originalDuration: video.duration,
      };

      setClips(prev => [...prev, newClip]);
      setDuration(prev => prev + video.duration);
      toast.success("Video imported");
    } catch (error) {
      console.error('Error importing video:', error);
      toast.error("Failed to import video");
    }
  };

  const handleSplitClip = () => {
    const clipToSplit = clips.find(
      clip => clip.type === 'video' && 
      currentTime >= clip.startTime && 
      currentTime < clip.startTime + clip.duration
    );

    if (!clipToSplit) {
      toast.error("No video clip at playhead position");
      return;
    }

    const splitPoint = currentTime - clipToSplit.startTime;

    const clip1: VideoClip = {
      ...clipToSplit,
      id: `${clipToSplit.id}-part1`,
      duration: splitPoint,
      trimEnd: (clipToSplit.trimStart || 0) + splitPoint,
    };

    const clip2: VideoClip = {
      ...clipToSplit,
      id: `${clipToSplit.id}-part2`,
      startTime: currentTime,
      duration: clipToSplit.duration - splitPoint,
      trimStart: (clipToSplit.trimStart || 0) + splitPoint,
    };

    setClips(prev => 
      prev.flatMap(c => c.id === clipToSplit.id ? [clip1, clip2] : [c])
    );
    
    toast.success("Clip split");
  };

  const handleAddText = (text: string, fontSize: number, color: string) => {
    const newClip: VideoClip = {
      id: `text-${Date.now()}`,
      type: 'text',
      url: '',
      startTime: currentTime,
      duration: 5,
      track: clips.filter(c => c.type === 'text').length + 2,
      text,
      textStyle: {
        fontFamily: 'Arial Black',
        fontSize,
        color,
        fontWeight: 'bold',
        textAlign: 'center',
      },
      transform: {
        x: 50,
        y: 50,
        width: 0,
        height: 0,
        rotation: 0,
        scale: 1,
      },
    };

    setClips(prev => [...prev, newClip]);
    setTextDialogOpen(false);
    toast.success("Text added");
  };

  const handleAddImage = (imageUrl: string) => {
    const newClip: VideoClip = {
      id: `image-${Date.now()}`,
      type: 'image',
      url: imageUrl,
      startTime: currentTime,
      duration: 5,
      track: clips.filter(c => c.type === 'image').length + 3,
      transform: {
        x: 70,
        y: 70,
        width: 25,
        height: 25,
        rotation: 0,
        scale: 0.3,
      },
    };

    setClips(prev => [...prev, newClip]);
    setImageDialogOpen(false);
    toast.success("Image added");
  };

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (time: number) => {
    setCurrentTime(Math.max(0, Math.min(duration, time)));
    setIsPlaying(false);
  };

  const handleClipsChange = (newClips: VideoClip[]) => {
    setClips(newClips);
  };

  const handleExport = async () => {
    if (clips.length === 0) {
      toast.error("No clips to export");
      return;
    }

    setIsExporting(true);
    
    try {
      toast.info("Initializing FFmpeg...");
      
      const ffmpeg = new FFmpeg();
      ffmpegRef.current = ffmpeg;
      
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });

      toast.info("Loading video files...");

      const videoClips = clips.filter(c => c.type === 'video');
      for (const [index, clip] of videoClips.entries()) {
        const data = await fetchFile(clip.url);
        await ffmpeg.writeFile(`video${index}.mp4`, data);
      }

      toast.info("Rendering video... This may take several minutes");

      ffmpeg.on('progress', ({ progress }) => {
        const percentage = Math.round(progress * 100);
        console.log(`Export progress: ${percentage}%`);
      });

      const format = CANVAS_FORMATS[selectedFormat];
      const filterComplex = videoClips.map((_, i) => 
        `[${i}:v]scale=${format.width}:${format.height}:force_original_aspect_ratio=decrease,pad=${format.width}:${format.height}:(ow-iw)/2:(oh-ih)/2,setsar=1[v${i}]`
      ).join(';');
      
      const concatInputs = videoClips.map((_, i) => `[v${i}]`).join('');
      const fullFilter = `${filterComplex};${concatInputs}concat=n=${videoClips.length}:v=1:a=0[vout]`;

      const inputs = videoClips.flatMap((_, i) => ['-i', `video${i}.mp4`]);
      
      await ffmpeg.exec([
        ...inputs,
        '-filter_complex', fullFilter,
        '-map', '[vout]',
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-crf', '23',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        'output.mp4'
      ]);

      toast.info("Reading output file...");

      const data = await ffmpeg.readFile('output.mp4') as Uint8Array;
      const blob = new Blob([new Uint8Array(data)], { type: 'video/mp4' });

      const fileName = `export-${Date.now()}.mp4`;
      toast.info("Uploading to cloud...");

      const { error: uploadError } = await supabase.storage
        .from('content-videos')
        .upload(fileName, blob);

      if (uploadError) throw uploadError;

      const { data: urlData } = await supabase.storage
        .from('content-videos')
        .createSignedUrl(fileName, 3600);

      if (urlData?.signedUrl) {
        const a = document.createElement('a');
        a.href = urlData.signedUrl;
        a.download = fileName;
        a.click();
        toast.success("Video exported and downloaded!");
      }
    } catch (error) {
      console.error('Export error:', error);
      toast.error(`Export failed: ${error}`);
    } finally {
      setIsExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading video editor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <VideoEditorToolbar
        onExport={handleExport}
        onImportVideo={handleImportVideo}
        onAddText={() => setTextDialogOpen(true)}
        onAddImage={() => setImageDialogOpen(true)}
        onSplit={handleSplitClip}
        selectedFormat={selectedFormat}
        onFormatChange={setSelectedFormat}
        isExporting={isExporting}
        hasClips={clips.length > 0}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <VideoEditorCanvas
          format={CANVAS_FORMATS[selectedFormat]}
          clips={clips}
          currentTime={currentTime}
          isPlaying={isPlaying}
        />

        <VideoEditorControls
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          onPlayPause={handlePlayPause}
          onSeek={handleSeek}
          hasClips={clips.length > 0}
        />

        <VideoEditorTimeline
          clips={clips}
          currentTime={currentTime}
          duration={duration}
          onClipsChange={handleClipsChange}
          onTimeChange={handleSeek}
        />
      </div>

      <TextOverlayDialog
        open={textDialogOpen}
        onOpenChange={setTextDialogOpen}
        onAdd={handleAddText}
      />

      <ImageOverlayDialog
        open={imageDialogOpen}
        onOpenChange={setImageDialogOpen}
        onAdd={handleAddImage}
      />
    </div>
  );
};

export default VideoEditor;
