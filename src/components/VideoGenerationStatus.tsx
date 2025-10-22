import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Download, Video, CheckCircle, Clock, AlertCircle } from "lucide-react";

interface VideoGenerationStatusProps {
  jobId: string;
  onComplete?: () => void;
}

interface ClipStatus {
  scene: number;
  status: string;
  url: string | null;
}

interface JobStatus {
  jobId: string;
  status: string;
  progress: number;
  scenes_total: number;
  scenes_completed: number;
  scenes_failed: number;
  clips: ClipStatus[];
  final_video_url: string | null;
  error_message: string | null;
  estimated_time_remaining: number;
}

export default function VideoGenerationStatus({ jobId, onComplete }: VideoGenerationStatusProps) {
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [isPolling, setIsPolling] = useState(true);

  useEffect(() => {
    let intervalId: number;

    const checkStatus = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('check-video-generation-status', {
          body: { jobId }
        });

        if (error) throw error;

        setStatus(data);

        if (data.status === 'completed') {
          setIsPolling(false);
          toast.success("Video generation completed!");
          if (onComplete) onComplete();
        } else if (data.status === 'failed') {
          setIsPolling(false);
          toast.error(data.error_message || "Video generation failed");
        }
      } catch (error) {
        console.error('Error checking status:', error);
        toast.error("Failed to check generation status");
      }
    };

    if (isPolling) {
      checkStatus(); // Initial check
      intervalId = window.setInterval(checkStatus, 5000); // Poll every 5 seconds
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [jobId, isPolling, onComplete]);

  const getStatusIcon = (s: string) => {
    if (s === 'completed') return <CheckCircle className="h-5 w-5 text-green-500" />;
    if (s === 'failed') return <AlertCircle className="h-5 w-5 text-red-500" />;
    return <Clock className="h-5 w-5 text-blue-500 animate-pulse" />;
  };

  const getStatusText = (s: string) => {
    const texts = {
      analyzing: 'Analyzing script...',
      generating_prompts: 'Generating video prompts...',
      generating_clips: 'Generating video clips...',
      assembling: 'Assembling final video...',
      completed: 'Completed!',
      failed: 'Failed'
    };
    return texts[s] || s;
  };

  const handleDownload = () => {
    if (status?.final_video_url) {
      window.open(status.final_video_url, '_blank');
    }
  };

  if (!status) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Clock className="h-5 w-5 animate-spin mr-2" />
            <span>Loading status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            Video Generation Progress
          </CardTitle>
          <CardDescription>Job ID: {jobId.slice(0, 8)}...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Overall Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getStatusIcon(status.status)}
                <span className="font-medium">{getStatusText(status.status)}</span>
              </div>
              <span className="text-sm text-muted-foreground">{status.progress}%</span>
            </div>
            <Progress value={status.progress} className="h-2" />
            {status.estimated_time_remaining > 0 && (
              <p className="text-sm text-muted-foreground">
                Estimated time remaining: ~{status.estimated_time_remaining} seconds
              </p>
            )}
          </div>

          {/* Scene Progress */}
          {status.scenes_total > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Scene Progress</h4>
              <div className="grid grid-cols-1 gap-2">
                {status.clips?.map((clip) => (
                  <div 
                    key={clip.scene}
                    className="flex items-center gap-2 p-2 rounded-lg border"
                  >
                    <div className="flex-1">
                      <span className="text-sm font-medium">Scene {clip.scene}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(clip.status)}
                      <span className="text-xs text-muted-foreground capitalize">
                        {clip.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 text-sm text-muted-foreground">
                <span>Total: {status.scenes_total}</span>
                <span>•</span>
                <span>Completed: {status.scenes_completed}</span>
                {status.scenes_failed > 0 && (
                  <>
                    <span>•</span>
                    <span className="text-red-500">Failed: {status.scenes_failed}</span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Error Message */}
          {status.error_message && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-600 dark:text-red-400">{status.error_message}</p>
            </div>
          )}

          {/* Download Button */}
          {status.status === 'completed' && status.final_video_url && (
            <Button onClick={handleDownload} className="w-full" size="lg">
              <Download className="mr-2 h-4 w-4" />
              Download Video
            </Button>
          )}

          {/* Preview */}
          {status.final_video_url && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Preview</h4>
              <video 
                src={status.final_video_url} 
                controls 
                className="w-full rounded-lg border"
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
