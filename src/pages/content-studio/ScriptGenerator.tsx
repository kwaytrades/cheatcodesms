import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Wand2, Copy, Save, Video, Sparkles, Minus, Plus, Play } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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

  // Fetch style guide for current format
  const { data: styleGuide } = useQuery({
    queryKey: ['style-guide', format],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data } = await supabase
        .from('style_guides')
        .select('*')
        .eq('user_id', user.id)
        .eq('format', format)
        .eq('is_active', true)
        .maybeSingle();

      return data;
    },
  });

  const generateScript = useMutation({
    mutationFn: async () => {
      if (!articleText.trim()) {
        throw new Error('Article text is required');
      }

      const { data, error } = await supabase.functions.invoke('generate-content-script', {
        body: {
          article_text: articleText,
          format,
          length_seconds: lengthSeconds,
          tone,
          hook_style: hookStyle,
          include_cta: includeCTA,
          include_broll: includeBroll,
          include_timestamps: includeTimestamps,
          include_market_data: includeMarketData,
          market_symbols: ['SPY', 'QQQ', 'AAPL'],
          style_guide: styleGuide
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setGeneratedScript(data.script);
      setWordCount(data.word_count);
      setReadTime(data.estimated_read_time);
      toast.success('Script generated successfully!');
    },
    onError: (error: Error) => {
      console.error('Script generation error:', error);
      toast.error('Failed to generate script');
    },
  });

  const rewriteScript = useMutation({
    mutationFn: async (type: 'shorten' | 'expand' | 'improve_hook') => {
      let modifiedLength = lengthSeconds;
      let modifiedText = articleText;

      if (type === 'shorten') {
        modifiedLength = Math.round(lengthSeconds * 0.7);
      } else if (type === 'expand') {
        modifiedLength = Math.round(lengthSeconds * 1.3);
      } else if (type === 'improve_hook') {
        modifiedText = `Focus on creating an even stronger hook. ${articleText}`;
      }

      const { data, error } = await supabase.functions.invoke('generate-content-script', {
        body: {
          article_text: modifiedText,
          format,
          length_seconds: modifiedLength,
          tone,
          hook_style: hookStyle,
          include_cta: includeCTA,
          include_broll: includeBroll,
          include_timestamps: includeTimestamps,
          include_market_data: includeMarketData,
          market_symbols: ['SPY', 'QQQ', 'AAPL'],
          style_guide: styleGuide
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setGeneratedScript(data.script);
      setWordCount(data.word_count);
      setReadTime(data.estimated_read_time);
      toast.success('Script rewritten!');
    },
    onError: () => {
      toast.error('Failed to rewrite script');
    },
  });

  const saveScript = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase.from('content_scripts').insert({
        user_id: user.id,
        title: `Script - ${format} - ${new Date().toLocaleDateString()}`,
        script_text: generatedScript,
        format,
        length_seconds: lengthSeconds,
        tone,
        hook_style: hookStyle,
        metadata: {
          word_count: wordCount,
          read_time: readTime,
          include_cta: includeCTA,
          include_broll: includeBroll,
          include_timestamps: includeTimestamps,
          include_market_data: includeMarketData
        }
      }).select().single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setSavedScriptId(data.id);
      toast.success('Script saved successfully!');
    },
    onError: (error: Error) => {
      toast.error('Failed to save script');
    },
  });

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedScript);
    toast.success('Script copied to clipboard!');
  };

  const openInTeleprompter = () => {
    if (generatedScript) {
      navigate('/content-studio/video-recorder', {
        state: { script: generatedScript }
      });
    }
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
    <div className="container mx-auto p-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Panel - Article Input and Settings */}
        <div className="space-y-4">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Article Source</h2>
            <div className="space-y-2">
              <Label htmlFor="article">Article Text</Label>
              <Textarea
                id="article"
                placeholder="Paste your article or news content here..."
                rows={12}
                value={articleText}
                onChange={(e) => setArticleText(e.target.value)}
                className="resize-none"
              />
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <h2 className="text-xl font-semibold mb-4">Script Settings</h2>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Format {selectedFormat?.icon}</Label>
                <Select value={format} onValueChange={setFormat}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMATS.map(f => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.icon} {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Length</Label>
                <Select value={lengthSeconds.toString()} onValueChange={(v) => setLengthSeconds(Number(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedFormat?.duration?.map(d => (
                      <SelectItem key={d} value={d.toString()}>
                        {d}s
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tone</Label>
                <Select value={tone} onValueChange={setTone}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TONES.map(t => (
                      <SelectItem key={t} value={t}>
                        {t.replace('_', ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
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

            <div className="space-y-3 pt-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="cta"
                  checked={includeCTA}
                  onCheckedChange={(checked) => setIncludeCTA(checked as boolean)}
                />
                <Label htmlFor="cta" className="text-sm font-normal cursor-pointer">
                  Include Call-to-Action
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="broll"
                  checked={includeBroll}
                  onCheckedChange={(checked) => setIncludeBroll(checked as boolean)}
                />
                <Label htmlFor="broll" className="text-sm font-normal cursor-pointer">
                  Include B-roll Suggestions
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="timestamps"
                  checked={includeTimestamps}
                  onCheckedChange={(checked) => setIncludeTimestamps(checked as boolean)}
                />
                <Label htmlFor="timestamps" className="text-sm font-normal cursor-pointer">
                  Include Timestamps
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="marketData"
                  checked={includeMarketData}
                  onCheckedChange={(checked) => setIncludeMarketData(checked as boolean)}
                />
                <Label htmlFor="marketData" className="text-sm font-normal cursor-pointer">
                  Include Real-time Market Data
                </Label>
              </div>
            </div>

            <Button
              onClick={() => generateScript.mutate()}
              disabled={generateScript.isPending || !articleText.trim()}
              className="w-full mt-4"
              size="lg"
            >
              {generateScript.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
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
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold">Generated Script</h2>
                  <div className="flex gap-2">
                    <Badge variant="secondary">
                      {wordCount} words
                    </Badge>
                    <Badge variant="secondary">
                      {readTime}s read
                    </Badge>
                  </div>
                </div>

                <div className="space-y-3 mb-4">
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={copyToClipboard}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => saveScript.mutate()}
                      disabled={saveScript.isPending}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={openInTeleprompter}
                      disabled={!generatedScript}
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Record
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={generateAIVideo}
                      disabled={!generatedScript}
                    >
                      <Video className="h-4 w-4 mr-2" />
                      Generate AI Video
                    </Button>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => rewriteScript.mutate('shorten')}
                      disabled={rewriteScript.isPending}
                    >
                      <Minus className="h-4 w-4 mr-2" />
                      Shorten
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => rewriteScript.mutate('expand')}
                      disabled={rewriteScript.isPending}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Expand
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => rewriteScript.mutate('improve_hook')}
                      disabled={rewriteScript.isPending}
                    >
                      <Wand2 className="h-4 w-4 mr-2" />
                      Improve Hook
                    </Button>
                  </div>
                </div>

                {format === 'carousel' ? (
                  <CarouselEditor scriptText={generatedScript} />
                ) : (
                  <Textarea
                    value={generatedScript}
                    onChange={(e) => setGeneratedScript(e.target.value)}
                    rows={20}
                    className="resize-none font-mono text-sm"
                  />
                )}
              </Card>
            </>
          ) : (
            <Card className="p-12">
              <div className="text-center text-muted-foreground">
                <Wand2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">No Script Generated Yet</p>
                <p className="text-sm">Enter article text and click "Generate Script" to get started</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScriptGenerator;