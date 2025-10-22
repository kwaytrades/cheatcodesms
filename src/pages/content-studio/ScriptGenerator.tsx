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
    onError: (error) => {
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
        story_id: storyFromState?.id || null,
        title: articleText.substring(0, 100) + '...',
        script_text: generatedScript,
        format,
        length_seconds: lengthSeconds,
        tone,
        hook_style: hookStyle,
        status: 'scripted',
        metadata: {
          word_count: wordCount,
          estimated_read_time: readTime,
          include_cta: includeCTA,
          include_broll: includeBroll,
          include_timestamps: includeTimestamps
        }
      }).select().single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Script saved!');
    },
    onError: () => {
      toast.error('Failed to save script');
    },
  });

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedScript);
    toast.success('Script copied to clipboard!');
  };

  const openInTeleprompter = () => {
    navigate('/content-studio/recorder', { state: { script: generatedScript } });
  };

  return (
    <div className="h-full flex gap-6 p-6 overflow-hidden">
      {/* LEFT PANEL - Input & Settings */}
      <div className="w-[40%] flex-none space-y-6 overflow-y-auto">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Article Source</h3>
          
          {storyFromState && (
            <div className="mb-4 p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline">{storyFromState.source}</Badge>
                <span className="text-sm text-muted-foreground">
                  Viral Score: {storyFromState.viral_score}/100
                </span>
              </div>
              <p className="text-sm font-medium">{storyFromState.title}</p>
            </div>
          )}

          <Label>Article Text</Label>
          <Textarea
            placeholder="Paste article text or it will load from selected story..."
            value={articleText}
            onChange={(e) => setArticleText(e.target.value)}
            className="min-h-[200px] mt-2"
          />
          <p className="text-xs text-muted-foreground mt-1">
            {articleText.length} characters
          </p>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Script Settings</h3>
          
          <div className="space-y-4">
            <div>
              <Label>Format</Label>
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORMATS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.icon} {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Length: {lengthSeconds}s {format === 'carousel' ? 'slides' : ''}</Label>
              <div className="flex items-center gap-2 mt-2">
                {selectedFormat?.duration.map((duration) => (
                  <Button
                    key={duration}
                    size="sm"
                    variant={lengthSeconds === duration ? 'default' : 'outline'}
                    onClick={() => setLengthSeconds(duration)}
                  >
                    {duration}{format === 'carousel' ? '' : 's'}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label>Tone</Label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TONES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t.replace('_', ' ').charAt(0).toUpperCase() + t.slice(1).replace('_', ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Hook Style</Label>
              <Select value={hookStyle} onValueChange={setHookStyle}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOOK_STYLES.map((h) => (
                    <SelectItem key={h} value={h}>
                      {h.charAt(0).toUpperCase() + h.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Include</Label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeCTA}
                    onChange={(e) => setIncludeCTA(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm">Call-to-action</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeBroll}
                    onChange={(e) => setIncludeBroll(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm">B-roll notes</span>
                </label>
                {format === 'youtube_long' && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeTimestamps}
                      onChange={(e) => setIncludeTimestamps(e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm">Timestamps</span>
                  </label>
                )}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeMarketData}
                    onChange={(e) => setIncludeMarketData(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm">Live market data (SPY, QQQ, AAPL)</span>
                </label>
              </div>
            </div>
          </div>

          <Button
            onClick={() => generateScript.mutate()}
            disabled={generateScript.isPending || !articleText.trim()}
            className="w-full mt-6"
          >
            {generateScript.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4 mr-2" />
                Generate Script
              </>
            )}
          </Button>
        </Card>
      </div>

      {/* RIGHT PANEL - Generated Script */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Card className="flex-1 flex flex-col overflow-hidden">
          {generatedScript ? (
            <>
              {/* Toolbar */}
              <div className="flex-none border-b border-border p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-4">
                    <div className="text-sm">
                      <span className="text-muted-foreground">Words:</span>{' '}
                      <span className="font-semibold">{wordCount}</span>
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">Read time:</span>{' '}
                      <span className="font-semibold">{readTime}s</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={copyToClipboard}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => saveScript.mutate()}
                      disabled={saveScript.isPending}
                    >
                      {saveScript.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Save
                    </Button>
                    <Button
                      size="sm"
                      onClick={openInTeleprompter}
                    >
                      <Video className="h-4 w-4 mr-2" />
                      Record Video
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">AI Rewrite:</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => rewriteScript.mutate('shorten')}
                    disabled={rewriteScript.isPending}
                  >
                    <Minus className="h-3 w-3 mr-1" />
                    Shorten
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => rewriteScript.mutate('expand')}
                    disabled={rewriteScript.isPending}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Expand
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => rewriteScript.mutate('improve_hook')}
                    disabled={rewriteScript.isPending}
                  >
                    <Sparkles className="h-3 w-3 mr-1" />
                    Improve Hook
                  </Button>
                </div>
              </div>

              {/* Script Display */}
              <div className="flex-1 overflow-y-auto p-6">
                {format === 'carousel' ? (
                  <CarouselEditor 
                    scriptText={generatedScript}
                    onSlidesChange={(slides) => {
                      // Update script text when slides change
                      const updatedScript = slides.map((slide, i) => 
                        `Slide ${i + 1}:\n${slide.text}`
                      ).join('\n\n');
                      setGeneratedScript(updatedScript);
                    }}
                  />
                ) : (
                  <Textarea
                    value={generatedScript}
                    onChange={(e) => setGeneratedScript(e.target.value)}
                    className="min-h-full font-mono text-base leading-relaxed resize-none border-0 focus-visible:ring-0"
                    style={{ 
                      background: 'transparent',
                      whiteSpace: 'pre-wrap'
                    }}
                  />
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center p-12">
              <div>
                <Wand2 className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-xl font-semibold mb-2">No Script Generated Yet</h3>
                <p className="text-muted-foreground mb-4">
                  Configure your settings and click "Generate Script" to create your video script
                </p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default ScriptGenerator;
