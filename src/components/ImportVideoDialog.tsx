import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Youtube, Video as VideoIcon, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

interface ImportVideoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: 'library' | 'news'; // library saves to imported_videos, news saves to news_stories
}

export const ImportVideoDialog = ({ open, onOpenChange, mode = 'library' }: ImportVideoDialogProps) => {
  const queryClient = useQueryClient();
  const [url, setUrl] = useState('');
  const [platform, setPlatform] = useState<'youtube' | 'tiktok' | 'instagram' | null>(null);
  const [extractedData, setExtractedData] = useState<{
    transcript: string;
    title: string;
    thumbnail: string;
    duration: number;
  } | null>(null);

  // Auto-detect platform from URL
  const detectPlatform = (inputUrl: string) => {
    if (inputUrl.includes('youtube.com') || inputUrl.includes('youtu.be')) {
      setPlatform('youtube');
    } else if (inputUrl.includes('tiktok.com') || inputUrl.includes('vm.tiktok.com')) {
      setPlatform('tiktok');
    } else if (inputUrl.includes('instagram.com')) {
      setPlatform('instagram');
    } else {
      setPlatform(null);
    }
  };

  const extractTranscript = useMutation({
    mutationFn: async () => {
      if (!url || !platform) {
        throw new Error('Please enter a valid video URL');
      }

      const { data, error } = await supabase.functions.invoke('extract-video-transcript', {
        body: { url, platform }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setExtractedData(data);
      toast.success('Transcript extracted successfully!');
    },
    onError: (error: Error) => {
      console.error('Transcript extraction error:', error);
      toast.error(`Failed to extract transcript: ${error.message}`);
    },
  });

  const saveToLibrary = useMutation({
    mutationFn: async () => {
      if (!extractedData || !platform) {
        throw new Error('No data to save');
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (mode === 'news') {
        // Analyze transcript with AI first
        let aiAnalysis = null;
        let viralScore = 50;
        let category = null;
        let tickers: string[] = [];

        try {
          const { data: analysisData, error: analysisError } = await supabase.functions.invoke('analyze-article', {
            body: { article_text: extractedData.transcript }
          });

          if (!analysisError && analysisData) {
            aiAnalysis = analysisData;
            viralScore = analysisData.viral_potential || 50;
            category = analysisData.category || null;
            tickers = analysisData.tickers_mentioned || [];
          }
        } catch (error) {
          console.error('AI analysis error:', error);
          // Continue with default values if analysis fails
        }

        // Save to news_stories table with AI insights
        const { data, error } = await supabase.from('news_stories').insert({
          user_id: user.id,
          title: aiAnalysis?.headline || extractedData.title,
          content: extractedData.transcript,
          url,
          source: platform === 'youtube' ? 'YouTube' : platform === 'tiktok' ? 'TikTok' : 'Instagram',
          viral_score: viralScore,
          category: category,
          tags: tickers.length > 0 ? tickers : null,
          ai_analysis: aiAnalysis
        }).select().single();

        if (error) throw error;
        return data;
      } else {
        // Save to imported_videos table
        const { data, error } = await supabase.from('imported_videos').insert({
          user_id: user.id,
          external_url: url,
          platform,
          title: extractedData.title,
          thumbnail_url: extractedData.thumbnail,
          transcript: extractedData.transcript,
          duration_seconds: extractedData.duration,
          metadata: { imported_at: new Date().toISOString() }
        }).select().single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      if (mode === 'news') {
        queryClient.invalidateQueries({ queryKey: ['news-stories'] });
        toast.success('Video transcript saved to news!');
      } else {
        queryClient.invalidateQueries({ queryKey: ['imported-videos'] });
        toast.success('Video saved to library!');
      }
      handleClose();
    },
    onError: (error: Error) => {
      toast.error(`Failed to save video: ${error.message}`);
    },
  });

  const handleClose = () => {
    setUrl('');
    setPlatform(null);
    setExtractedData(null);
    onOpenChange(false);
  };

  const getPlatformIcon = () => {
    switch (platform) {
      case 'youtube':
        return <Youtube className="h-4 w-4 text-red-500" />;
      case 'tiktok':
        return <VideoIcon className="h-4 w-4 text-[#00F2EA]" />;
      case 'instagram':
        return <ImageIcon className="h-4 w-4 text-[#E4405F]" />;
      default:
        return null;
    }
  };

  const getPlatformBadge = () => {
    if (!platform) return null;
    
    const colors = {
      youtube: 'bg-red-500',
      tiktok: 'bg-[#00F2EA] text-black',
      instagram: 'bg-[#E4405F]'
    };

    return (
      <Badge className={colors[platform]}>
        {getPlatformIcon()}
        <span className="ml-1 capitalize">{platform}</span>
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Video</DialogTitle>
          <DialogDescription>
            Paste a video URL from YouTube, TikTok, or Instagram to extract its transcript
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="video-url">Video URL</Label>
            <div className="flex gap-2">
              <Input
                id="video-url"
                placeholder="https://youtube.com/watch?v=..."
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  detectPlatform(e.target.value);
                }}
              />
              {getPlatformBadge()}
            </div>
          </div>

          {!extractedData && (
            <Button
              onClick={() => extractTranscript.mutate()}
              disabled={!url || !platform || extractTranscript.isPending}
              className="w-full"
            >
              {extractTranscript.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Extracting Transcript... (This may take 1-2 minutes)
                </>
              ) : (
                'Extract Transcript'
              )}
            </Button>
          )}

          {extractedData && (
            <>
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={extractedData.title}
                  onChange={(e) => setExtractedData({ ...extractedData, title: e.target.value })}
                />
              </div>

              {extractedData.thumbnail && (
                <div className="space-y-2">
                  <Label>Thumbnail Preview</Label>
                  <img
                    src={extractedData.thumbnail}
                    alt="Video thumbnail"
                    className="w-full h-auto rounded-lg border"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Transcript ({extractedData.transcript.split(' ').length} words)</Label>
                <Textarea
                  value={extractedData.transcript}
                  onChange={(e) => setExtractedData({ ...extractedData, transcript: e.target.value })}
                  rows={12}
                  className="resize-none font-mono text-sm"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleClose}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => saveToLibrary.mutate()}
                  disabled={saveToLibrary.isPending}
                  className="flex-1"
                >
                  {saveToLibrary.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {mode === 'news' ? 'Analyzing & Saving...' : 'Saving...'}
                    </>
                  ) : mode === 'news' ? (
                    'Save to News'
                  ) : (
                    'Save to Library'
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};