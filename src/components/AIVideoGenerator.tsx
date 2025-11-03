import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Video, Sparkles } from "lucide-react";
import VideoGenerationStatus from "./VideoGenerationStatus";

interface AIVideoGeneratorProps {
  initialScript?: string;
  scriptId?: string;
}

export default function AIVideoGenerator({ initialScript = "", scriptId }: AIVideoGeneratorProps) {
  const [scriptText, setScriptText] = useState(initialScript);
  const [targetDuration, setTargetDuration] = useState<number>(30);
  const [format, setFormat] = useState("professional");
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!scriptText.trim()) {
      toast.error("Please enter a script");
      return;
    }

    setIsGenerating(true);

    try {
      const { data, error } = await supabase.functions.invoke('generate-heygen-video', {
        body: {
          script: scriptText,
          targetDuration: targetDuration,
          format: format,
          scriptId: scriptId
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success("Video generation started with HeyGen!");
      } else {
        throw new Error(data?.error || 'Failed to start video generation');
      }
    } catch (error) {
      console.error('Error generating video:', error);
      toast.error(error instanceof Error ? error.message : "Failed to submit script");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            AI Video Generator
          </CardTitle>
          <CardDescription>
            Transform your script into a professional video using HeyGen AI
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Script</label>
            <Textarea
              value={scriptText}
              onChange={(e) => setScriptText(e.target.value)}
              placeholder="Enter your video script here..."
              rows={10}
              className="resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Duration</label>
              <Select value={targetDuration.toString()} onValueChange={(v) => setTargetDuration(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 seconds</SelectItem>
                  <SelectItem value="30">30 seconds</SelectItem>
                  <SelectItem value="45">45 seconds</SelectItem>
                  <SelectItem value="60">60 seconds</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Style</label>
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="casual">Casual</SelectItem>
                  <SelectItem value="documentary">Documentary</SelectItem>
                  <SelectItem value="energetic">Energetic</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button 
            onClick={handleGenerate} 
            disabled={isGenerating || !scriptText.trim()}
            className="w-full"
            size="lg"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Starting Generation...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate AI Video
              </>
            )}
          </Button>

          <div className="text-sm text-muted-foreground space-y-1">
            <p>• Script will be sent directly to HeyGen for video generation</p>
            <p>• Processing typically takes 2-5 minutes depending on length</p>
            <p>• You'll receive the video URL once generation is complete</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
