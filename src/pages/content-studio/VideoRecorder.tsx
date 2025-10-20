import { useState, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Webcam from "react-webcam";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, Pause, RotateCcw, Maximize, Circle, Square, Loader2, Check, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import ReactPlayer from "react-player";

const FONT_SIZES = [16, 20, 24, 32, 40];
const FONTS = ['sans-serif', 'serif', 'monospace'];

const VideoRecorder = () => {
  const location = useLocation();
  const queryClient = useQueryClient();
  const scriptFromState = location.state?.script;
  
  // Teleprompter state
  const [script, setScript] = useState(scriptFromState || 'Load a script from Script Generator or paste your text here...');
  const [isScrolling, setIsScrolling] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState([1]);
  const [fontSize, setFontSize] = useState(24);
  const [fontFamily, setFontFamily] = useState('sans-serif');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const teleprompterRef = useRef<HTMLDivElement>(null);
  const scrollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Recording state
  const webcamRef = useRef<Webcam>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Device selection
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [selectedMicrophone, setSelectedMicrophone] = useState<string>('');

  // Get available devices
  useEffect(() => {
    const getDevices = async () => {
      const deviceList = await navigator.mediaDevices.enumerateDevices();
      setDevices(deviceList);
      
      const videoDevice = deviceList.find(d => d.kind === 'videoinput');
      const audioDevice = deviceList.find(d => d.kind === 'audioinput');
      
      if (videoDevice) setSelectedCamera(videoDevice.deviceId);
      if (audioDevice) setSelectedMicrophone(audioDevice.deviceId);
    };
    getDevices();
  }, []);

  // Auto-scroll logic
  useEffect(() => {
    if (isScrolling && teleprompterRef.current) {
      scrollIntervalRef.current = setInterval(() => {
        if (teleprompterRef.current) {
          teleprompterRef.current.scrollTop += scrollSpeed[0] * 0.5;
        }
      }, 16); // ~60fps
    } else if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
    }

    return () => {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
      }
    };
  }, [isScrolling, scrollSpeed]);

  // Recording timer
  useEffect(() => {
    if (isRecording && !isPaused) {
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording, isPaused]);

  const toggleScroll = () => setIsScrolling(!isScrolling);

  const resetScroll = () => {
    if (teleprompterRef.current) {
      teleprompterRef.current.scrollTop = 0;
    }
  };

  const toggleFullscreen = () => {
    if (!isFullscreen && teleprompterRef.current?.parentElement) {
      teleprompterRef.current.parentElement.requestFullscreen();
      setIsFullscreen(true);
    } else if (document.fullscreenElement) {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleStartRecording = () => {
    if (webcamRef.current?.stream) {
      const stream = webcamRef.current.stream;
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 5000000,
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          setRecordedChunks((prev) => [...prev, event.data]);
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      toast.success('Recording started');
    }
  };

  const handlePauseResume = () => {
    if (mediaRecorderRef.current) {
      if (isPaused) {
        mediaRecorderRef.current.resume();
        setIsPaused(false);
        toast.info('Recording resumed');
      } else {
        mediaRecorderRef.current.pause();
        setIsPaused(true);
        toast.info('Recording paused');
      }
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      toast.success('Recording stopped');
    }
  };

  // Create video URL when chunks are ready
  useEffect(() => {
    if (recordedChunks.length > 0 && !isRecording) {
      const blob = new Blob(recordedChunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      setRecordedVideoUrl(url);
    }
  }, [recordedChunks, isRecording]);

  const handleRetake = () => {
    setRecordedChunks([]);
    setRecordedVideoUrl(null);
    setRecordingTime(0);
  };

  const uploadVideo = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (recordedChunks.length === 0) throw new Error('No video to upload');

      const blob = new Blob(recordedChunks, { type: 'video/mp4' });
      const fileName = `video-${Date.now()}.mp4`;
      const filePath = `${user.id}/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('content-videos')
        .upload(filePath, blob);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('content-videos')
        .getPublicUrl(filePath);

      // Save to database
      const { error: dbError } = await supabase.from('content_videos').insert({
        user_id: user.id,
        video_url: filePath,
        duration_seconds: recordingTime,
        file_size_bytes: blob.size,
        take_number: 1,
        is_final: true
      });

      if (dbError) throw dbError;

      return publicUrl;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-videos'] });
      toast.success('Video uploaded successfully!');
      handleRetake();
    },
    onError: (error) => {
      console.error('Upload error:', error);
      toast.error('Failed to upload video');
    },
  });

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-full flex gap-6 p-6 overflow-hidden">
      {/* LEFT COLUMN - Teleprompter */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Card className="flex-1 flex flex-col overflow-hidden">
          {/* Controls */}
          <div className="flex-none border-b border-border p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={isScrolling ? 'default' : 'outline'}
                onClick={toggleScroll}
              >
                {isScrolling ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <Button size="sm" variant="outline" onClick={resetScroll}>
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" onClick={toggleFullscreen}>
                <Maximize className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-xs">Speed: {scrollSpeed[0]}x</Label>
                <Slider
                  value={scrollSpeed}
                  onValueChange={setScrollSpeed}
                  min={0.5}
                  max={3}
                  step={0.5}
                  className="mt-2"
                />
              </div>
              <div>
                <Label className="text-xs">Font Size</Label>
                <div className="flex gap-1 mt-2">
                  {FONT_SIZES.map(size => (
                    <Button
                      key={size}
                      size="sm"
                      variant={fontSize === size ? 'default' : 'outline'}
                      onClick={() => setFontSize(size)}
                      className="px-2"
                    >
                      {size}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs">Font</Label>
                <Select value={fontFamily} onValueChange={setFontFamily}>
                  <SelectTrigger className="mt-2 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FONTS.map(font => (
                      <SelectItem key={font} value={font}>
                        {font}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Teleprompter Display */}
          <div
            ref={teleprompterRef}
            className="flex-1 overflow-y-auto p-8"
            style={{
              fontSize: `${fontSize}px`,
              fontFamily: fontFamily,
              lineHeight: '1.8'
            }}
          >
            <div className="max-w-3xl mx-auto whitespace-pre-wrap">
              {script}
            </div>
          </div>
        </Card>
      </div>

      {/* RIGHT COLUMN - Recording */}
      <div className="w-[40%] flex-none space-y-4 overflow-y-auto">
        {!recordedVideoUrl ? (
          <>
            {/* Webcam Preview */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3">Camera Preview</h3>
              <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                <Webcam
                  ref={webcamRef}
                  audio={true}
                  muted={true}
                  videoConstraints={{
                    deviceId: selectedCamera,
                    width: 1920,
                    height: 1080
                  }}
                  audioConstraints={{
                    deviceId: selectedMicrophone
                  }}
                  className="w-full h-full object-cover"
                />
                {isRecording && (
                  <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-500 text-white px-3 py-1 rounded-full">
                    <Circle className="h-3 w-3 fill-white animate-pulse" />
                    <span className="font-mono text-sm">{formatTime(recordingTime)}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 mt-3">
                <div>
                  <Label className="text-xs">Camera</Label>
                  <Select value={selectedCamera} onValueChange={setSelectedCamera}>
                    <SelectTrigger className="mt-1 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {devices.filter(d => d.kind === 'videoinput').map(device => (
                        <SelectItem key={device.deviceId} value={device.deviceId}>
                          {device.label || 'Camera'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Microphone</Label>
                  <Select value={selectedMicrophone} onValueChange={setSelectedMicrophone}>
                    <SelectTrigger className="mt-1 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {devices.filter(d => d.kind === 'audioinput').map(device => (
                        <SelectItem key={device.deviceId} value={device.deviceId}>
                          {device.label || 'Microphone'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>

            {/* Recording Controls */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3">Recording</h3>
              {!isRecording ? (
                <Button
                  onClick={handleStartRecording}
                  className="w-full bg-red-500 hover:bg-red-600"
                >
                  <Circle className="h-4 w-4 mr-2 fill-white" />
                  Start Recording
                </Button>
              ) : (
                <div className="space-y-2">
                  <Button
                    onClick={handlePauseResume}
                    variant="outline"
                    className="w-full"
                  >
                    {isPaused ? (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        Resume
                      </>
                    ) : (
                      <>
                        <Pause className="h-4 w-4 mr-2" />
                        Pause
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={handleStopRecording}
                    variant="outline"
                    className="w-full"
                  >
                    <Square className="h-4 w-4 mr-2" />
                    Stop & Review
                  </Button>
                </div>
              )}
            </Card>
          </>
        ) : (
          <>
            {/* Video Preview */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3">Review Recording</h3>
              <div className="aspect-video bg-black rounded-lg overflow-hidden">
                <ReactPlayer
                  url={recordedVideoUrl}
                  controls
                  width="100%"
                  height="100%"
                  volume={1}
                  muted={false}
                />
              </div>
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Duration:</span>
                  <span className="font-semibold">{formatTime(recordingTime)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Size:</span>
                  <span className="font-semibold">
                    {(new Blob(recordedChunks).size / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>
              </div>
            </Card>

            {/* Actions */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3">Actions</h3>
              <div className="space-y-2">
                <Button
                  onClick={() => uploadVideo.mutate()}
                  disabled={uploadVideo.isPending}
                  className="w-full"
                >
                  {uploadVideo.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading to Library...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Upload to Content Library
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleRetake}
                  variant="outline"
                  className="w-full"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Retake
                </Button>
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};

export default VideoRecorder;
