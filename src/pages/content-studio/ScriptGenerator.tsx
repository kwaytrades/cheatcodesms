import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Wand2, Copy, Save, Video, Sparkles, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { CarouselEditor } from "@/components/CarouselEditor";

const FORMATS = [
  { value: 'youtube_long', label: 'YouTube Long-form', icon: '📹', duration: [180, 300, 600, 900] },
  { value: 'youtube_short', label: 'YouTube Short', icon: '🎬', duration: [30, 45, 60] },
  { value: 'tiktok', label: 'TikTok/Reel', icon: '📱', duration: [15, 30, 45, 60] },
  { value: 'carousel', label: 'LinkedIn Carousel', icon: '📊', duration: [8, 10, 12] }
];

const TONES = ['educational', 'hype', 'breaking_news', 'analytical', 'casual'];
const HOOK_STYLES = ['question', 'stat', 'story', 'contrarian'];

const ScriptGenerator = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const storyFromState = location.state?.story;

  const [articleText, setArticleText] = useState(storyFromState?.content || '');
  const [format, setFormat] = useState('youtube_long');
  const [lengthSeconds, setLengthSeconds] = useState(300);
  const [tone, setTone] = useState('educational');
  const [hookStyle, setHookStyle] = useState('question');
  const [includeCTA, setIncludeCTA] = useState(true);
  const [includeBroll, setIncludeBroll] = useState(true);
  const [includeTimestamps, setIncludeTimestamps] = useState(true);
  const [includeMarketData, setIncludeMarketData] = useState(false);
  const [generatedScript, setGeneratedScript] = useState('');
  const [wordCount, setWordCount] = useState(0);
  const [readTime, setReadTime] = useState(0);
  const [savedScriptId, setSavedScriptId] = useState<string | null>(null);

  const selectedFormat = FORMATS.find(f => f.value === format);

  const generateScriptMutation = useMutation({
    mutationFn: async () => {
      if (!articleText) {
        throw new Error("Article text is required");
      }

      const { data, error } = await supabase.functions.invoke('generate-content-script', {
        body: {
          article_text: articleText,
          format: format,
          length_seconds: lengthSeconds,
          tone: tone,
          hook_style: hookStyle,
          include_cta: includeCTA,
          include_broll: includeBroll,
          include_timestamps: includeTimestamps,
          include_market_data: includeMarketData
        }
      });

      if (error) {
        console.error("Function invoke error:", error);
        throw new Error(error.message || "Failed to generate script");
      }

      return data;
    },
    onSuccess: (data) => {
      setGeneratedScript(data.script);
      setWordCount(data.word_count || 0);
      setReadTime(data.estimated_read_time || 0);
      toast.success("Script generated successfully!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to generate script");
    }
  });

  const saveScriptMutation = useMutation({
    mutationFn: async () => {
      if (!generatedScript) {
        throw new Error("No script to save");
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('content_scripts')
        .insert({
          user_id: user.id,
          script_text: generatedScript,
          title: `Script - ${format} - ${new Date().toLocaleDateString()}`,
          format: format,
          length_seconds: lengthSeconds,
          tone: tone,
          hook_style: hookStyle,
          metadata: {
            include_cta: includeCTA,
            include_broll: includeBroll,
            include_timestamps: includeTimestamps,
            include_market_data: includeMarketData
          }
        })
        .select()
        .single();

      if (error) {
        console.error("Supabase insert error:", error);
        throw new Error(error.message || "Failed to save script");
      }

      return data;
    },
    onSuccess: (data) => {
      setSavedScriptId(data.id);
      toast.success("Script saved successfully!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to save script");
    }
  });

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedScript);
    toast.success("Script copied to clipboard!");
  };

  const openInTeleprompter = () => {
    // Navigate to the teleprompter page with the generated script
    navigate('/teleprompter', { state: { script: generatedScript } });
  };

  const generateAIVideo = () => {
    if (generatedScript) {
      navigate('/content-studio/ai-video', {
        state: { 
          script: generatedScript,
          scriptId: savedScriptId
        }
      });
    }
  };

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Left Panel - Article Input and Settings */}
      <div className="space-y-4">
        <Card className="p-4">
          <div className="space-y-2">
            <Label htmlFor="article">Article Text</Label>
            <Textarea
              id="article"
              placeholder="Enter your article text here..."
              rows={10}
              value={articleText}
              onChange={(e) => setArticleText(e.target.value)}
            />
          </div>
        </Card>

        <Card className="p-4 space-y-4">
          <h3 className="text-lg font-semibold">Settings</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Format</Label>
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORMATS.map(f => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Length (seconds)</Label>
              <Select value={lengthSeconds.toString()} onValueChange={(v) => setLengthSeconds(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {selectedFormat?.duration?.map(d => (
                    <SelectItem key={d} value={d.toString()}>
                      {d} seconds
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Tone</Label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TONES.map(t => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Hook Style</Label>
              <Select value={hookStyle} onValueChange={setHookStyle}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOOK_STYLES.map(h => (
                    <SelectItem key={h} value={h}>
                      {h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="cta"
              className="h-4 w-4"
              checked={includeCTA}
              onChange={(e) => setIncludeCTA(e.target.checked)}
            />
            <Label htmlFor="cta">Include Call to Action</Label>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="broll"
              className="h-4 w-4"
              checked={includeBroll}
              onChange={(e) => setIncludeBroll(e.target.checked)}
            />
            <Label htmlFor="broll">Include B-roll Suggestions</Label>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="timestamps"
              className="h-4 w-4"
              checked={includeTimestamps}
              onChange={(e) => setIncludeTimestamps(e.target.checked)}
            />
            <Label htmlFor="timestamps">Include Timestamps</Label>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="marketData"
              className="h-4 w-4"
              checked={includeMarketData}
              onChange={(e) => setIncludeMarketData(e.target.checked)}
            />
            <Label htmlFor="marketData">Include Market Data</Label>
          </div>

          <Button
            onClick={() => generateScriptMutation.mutate()}
            disabled={generateScriptMutation.isPending || !articleText}
            className="w-full"
          >
            {generateScriptMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Wand2 className="mr-2 h-4 w-4" />
                Generate Script
              </>
            )}
          </Button>
        </Card>
      </div>

      {/* Right Panel - Generated Script */}
      <div className="space-y-4">
        {generatedScript ? (
          <>
            <Card className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={copyToClipboard}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => saveScriptMutation.mutate()}>
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                  <Button variant="outline" size="sm" onClick={openInTeleprompter}>
                    Record
                  </Button>
                  <Button variant="outline" size="sm" onClick={generateAIVideo}>
                    <Video className="h-4 w-4 mr-2" />
                    AI Video
                  </Button>
                </div>
              </div>
              <Textarea
                value={generatedScript}
                readOnly
                rows={15}
                className="resize-none"
              />
            </Card>

            <div className="flex justify-between items-center">
              <div className="flex gap-2">
                <Badge variant="secondary">Word Count: {wordCount}</Badge>
                <Badge variant="secondary">Read Time: {readTime} seconds</Badge>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default ScriptGenerator;
