import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Search, FileText, Sparkles, Trash2, Video, Youtube, Instagram } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useNavigate } from "react-router-dom";
import { ImportVideoDialog } from "@/components/ImportVideoDialog";

const SOURCES = ['Bloomberg', 'Reuters', 'CNBC', 'Twitter', 'Reddit', 'Perplexity', 'Manual'];
const CATEGORIES = ['Stocks', 'Crypto', 'ETFs', 'Options', 'Earnings', 'Fed Policy', 'Market Analysis'];

const NewsDiscovery = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [perplexityDialogOpen, setPerplexityDialogOpen] = useState(false);
  const [importVideoDialogOpen, setImportVideoDialogOpen] = useState(false);
  const [selectedSource, setSelectedSource] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string[]>([]);

  // Fetch news stories
  const { data: stories, isLoading } = useQuery({
    queryKey: ['news-stories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('news_stories')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // Delete story mutation
  const deleteStory = useMutation({
    mutationFn: async (storyId: string) => {
      const { error } = await supabase
        .from('news_stories')
        .delete()
        .eq('id', storyId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['news-stories'] });
      toast.success('Story deleted');
    },
    onError: () => {
      toast.error('Failed to delete story');
    },
  });

  // Filter stories based on selected filters
  const filteredStories = stories?.filter(story => {
    if (selectedSource.length > 0 && !selectedSource.includes(story.source)) return false;
    if (selectedCategory.length > 0 && !selectedCategory.includes(story.category)) return false;
    return true;
  });

  const getViralScoreColor = (score: number) => {
    if (score >= 80) return 'bg-gradient-to-r from-red-500 to-orange-500';
    if (score >= 60) return 'bg-gradient-to-r from-orange-500 to-yellow-500';
    if (score >= 40) return 'bg-gradient-to-r from-yellow-500 to-green-500';
    return 'bg-gradient-to-r from-green-500 to-blue-500';
  };

  return (
    <div className="h-full flex gap-6 p-6 overflow-hidden">
      {/* LEFT SIDEBAR - Filters */}
      <div className="w-64 flex-none space-y-6 overflow-y-auto">
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Source</h3>
          <div className="space-y-2">
            {SOURCES.map((source) => (
              <label key={source} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedSource.includes(source)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedSource([...selectedSource, source]);
                    } else {
                      setSelectedSource(selectedSource.filter(s => s !== source));
                    }
                  }}
                  className="rounded"
                />
                <span className="text-sm">{source}</span>
              </label>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold mb-3">Category</h3>
          <div className="space-y-2">
            {CATEGORIES.map((category) => (
              <label key={category} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedCategory.includes(category)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedCategory([...selectedCategory, category]);
                    } else {
                      setSelectedCategory(selectedCategory.filter(c => c !== category));
                    }
                  }}
                  className="rounded"
                />
                <span className="text-sm">{category}</span>
              </label>
            ))}
          </div>
        </Card>

        {(selectedSource.length > 0 || selectedCategory.length > 0) && (
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => {
              setSelectedSource([]);
              setSelectedCategory([]);
            }}
          >
            Clear Filters
          </Button>
        )}
      </div>

      {/* CENTER - Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Action Buttons */}
        <div className="flex-none mb-6 flex gap-3">
          <Dialog open={manualDialogOpen} onOpenChange={setManualDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Manual Input
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add Article Manually</DialogTitle>
              </DialogHeader>
              <ManualInputForm onClose={() => setManualDialogOpen(false)} />
            </DialogContent>
          </Dialog>

          <Dialog open={perplexityDialogOpen} onOpenChange={setPerplexityDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                Search with Perplexity
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Search Trending News</DialogTitle>
              </DialogHeader>
              <PerplexitySearchForm onClose={() => setPerplexityDialogOpen(false)} />
            </DialogContent>
          </Dialog>

          <Button 
            variant="outline" 
            className="flex items-center gap-2"
            onClick={() => setImportVideoDialogOpen(true)}
          >
            <Video className="h-4 w-4" />
            Import Video
          </Button>
        </div>

        {/* Import Video Dialog */}
        <ImportVideoDialog 
          open={importVideoDialogOpen} 
          onOpenChange={setImportVideoDialogOpen}
          mode="news"
        />

        {/* Stories Feed */}
        <div className="flex-1 overflow-y-auto space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredStories && filteredStories.length > 0 ? (
            filteredStories.map((story) => (
              <Card key={story.id} className="p-6 hover:shadow-lg transition-shadow">
                <div className="space-y-4">
                  {/* Viral Score Bar */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Viral Potential</span>
                      <span className="font-semibold">{story.viral_score}/100</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${getViralScoreColor(story.viral_score)}`}
                        style={{ width: `${story.viral_score}%` }}
                      />
                    </div>
                  </div>

                  {/* Title and Metadata */}
                  <div>
                    <h3 className="text-xl font-bold mb-2">{story.title}</h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Badge 
                        variant="outline" 
                        className={
                          story.source === 'YouTube' ? 'border-red-500 text-red-600' :
                          story.source === 'TikTok' ? 'border-[#00F2EA] text-[#00F2EA]' :
                          story.source === 'Instagram' ? 'border-[#E4405F] text-[#E4405F]' :
                          ''
                        }
                      >
                        {story.source === 'YouTube' && <Youtube className="h-3 w-3 mr-1" />}
                        {story.source === 'TikTok' && <Video className="h-3 w-3 mr-1" />}
                        {story.source === 'Instagram' && <Instagram className="h-3 w-3 mr-1" />}
                        {story.source}
                      </Badge>
                      {story.category && <Badge variant="secondary">{story.category}</Badge>}
                      <span>•</span>
                      <span>{new Date(story.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Content Preview */}
                  <p className="text-muted-foreground line-clamp-3">{story.content}</p>

                  {/* Tags */}
                  {story.tags && story.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {story.tags.map((tag, index) => (
                        <Badge key={index} variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* AI Analysis */}
                  {story.ai_analysis && typeof story.ai_analysis === 'object' && 'key_points' in story.ai_analysis && (
                    <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Sparkles className="h-4 w-4 text-[#A25DDC]" />
                        AI Insights
                      </div>
                      <ul className="text-sm space-y-1 list-disc list-inside">
                        {(story.ai_analysis.key_points as string[]).slice(0, 3).map((point: string, index: number) => (
                          <li key={index}>{point}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      onClick={() => navigate('/content-studio/scripts', { state: { story } })}
                      className="flex items-center gap-2"
                    >
                      <FileText className="h-4 w-4" />
                      Create Script
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteStory.mutate(story.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">No stories yet</p>
              <p className="text-sm">Add your first article manually or search with Perplexity</p>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT SIDEBAR - Quick Actions */}
      <div className="w-64 flex-none">
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Recently Saved</h3>
          <div className="space-y-2">
            {stories?.slice(0, 5).map((story) => (
              <button
                key={story.id}
                className="w-full text-left p-2 rounded hover:bg-muted transition-colors"
                onClick={() => {
                  const element = document.getElementById(story.id);
                  element?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                <p className="text-sm font-medium line-clamp-2">{story.title}</p>
                <p className="text-xs text-muted-foreground">{story.source}</p>
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

// Manual Input Form Component
const ManualInputForm = ({ onClose }: { onClose: () => void }) => {
  const queryClient = useQueryClient();
  const [article, setArticle] = useState('');
  const [url, setUrl] = useState('');
  const [source, setSource] = useState('Manual');
  const [category, setCategory] = useState('');
  const [viralScore, setViralScore] = useState([50]);
  const [tags, setTags] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);

  const handleAnalyze = async () => {
    if (!article.trim()) {
      toast.error('Please enter article text');
      return;
    }

    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-article', {
        body: { article_text: article }
      });

      if (error) throw error;
      setAnalysis(data);
      setViralScore([data.viral_potential || 50]);
      if (data.category) setCategory(data.category);
      if (data.tickers_mentioned) setTags(data.tickers_mentioned.join(', '));
      toast.success('AI analysis complete');
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('Failed to analyze article');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSave = async () => {
    if (!article.trim()) {
      toast.error('Article text is required');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase.from('news_stories').insert({
        user_id: user.id,
        title: analysis?.headline || article.substring(0, 100) + '...',
        content: article,
        url: url || null,
        source,
        viral_score: viralScore[0],
        category: category || null,
        tags: tags ? tags.split(',').map(t => t.trim()) : null,
        ai_analysis: analysis
      });

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['news-stories'] });
      toast.success('Story saved');
      onClose();
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save story');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Article Text *</Label>
        <Textarea
          placeholder="Paste the full article text here..."
          value={article}
          onChange={(e) => setArticle(e.target.value)}
          className="min-h-[200px] mt-2"
        />
      </div>

      <div>
        <Label>URL (optional)</Label>
        <Input
          placeholder="https://..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="mt-2"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Source</Label>
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger className="mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SOURCES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Category</Label>
          <Select value={category || undefined} onValueChange={setCategory}>
            <SelectTrigger className="mt-2">
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>Viral Potential: {viralScore[0]}/100</Label>
        <Slider
          value={viralScore}
          onValueChange={setViralScore}
          max={100}
          step={5}
          className="mt-2"
        />
      </div>

      <div>
        <Label>Tags (comma-separated)</Label>
        <Input
          placeholder="AAPL, TSLA, tech stocks..."
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          className="mt-2"
        />
      </div>

      <Button
        onClick={handleAnalyze}
        disabled={analyzing || !article.trim()}
        variant="outline"
        className="w-full"
      >
        {analyzing ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Analyzing with AI...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4 mr-2" />
            Analyze with AI
          </>
        )}
      </Button>

      {analysis && (
        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="h-4 w-4 text-[#A25DDC]" />
            AI Analysis Results
          </div>
          {analysis.headline && <p className="text-sm"><strong>Headline:</strong> {analysis.headline}</p>}
          {analysis.key_points && (
            <div className="text-sm">
              <strong>Key Points:</strong>
              <ul className="list-disc list-inside mt-1">
                {analysis.key_points.map((point: string, index: number) => (
                  <li key={index}>{point}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <Button onClick={handleSave} className="flex-1">Save Story</Button>
        <Button onClick={onClose} variant="outline">Cancel</Button>
      </div>
    </div>
  );
};

// Perplexity Search Form Component
const PerplexitySearchForm = ({ onClose }: { onClose: () => void }) => {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [recency, setRecency] = useState('day');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<any[]>([]);

  const handleSearch = async () => {
    if (!query.trim()) {
      toast.error('Please enter a search query');
      return;
    }

    setSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke('search-news-perplexity', {
        body: { query, recency }
      });

      if (error) throw error;
      setResults(data.articles || []);
      if (data.articles?.length === 0) {
        toast.info('No articles found');
      } else {
        toast.success(`Found ${data.articles.length} articles`);
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Failed to search news');
    } finally {
      setSearching(false);
    }
  };

  const handleSaveArticle = async (article: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // First analyze the article
      const { data: analysis } = await supabase.functions.invoke('analyze-article', {
        body: { article_text: article.summary }
      });

      const { error } = await supabase.from('news_stories').insert({
        user_id: user.id,
        title: article.title,
        content: article.summary,
        url: article.url,
        source: 'Perplexity',
        viral_score: analysis?.viral_potential || 50,
        category: analysis?.category || null,
        tags: analysis?.tickers_mentioned || null,
        ai_analysis: analysis
      });

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['news-stories'] });
      toast.success('Article saved');
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save article');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Search Query</Label>
        <Input
          placeholder="e.g., NVIDIA stock news, Fed rate decision, crypto market crash..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="mt-2"
        />
      </div>

      <div>
        <Label>Recency</Label>
        <Select value={recency} onValueChange={setRecency}>
          <SelectTrigger className="mt-2">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Last Day</SelectItem>
            <SelectItem value="week">Last Week</SelectItem>
            <SelectItem value="month">Last Month</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button onClick={handleSearch} disabled={searching} className="w-full">
        {searching ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Searching...
          </>
        ) : (
          <>
            <Search className="h-4 w-4 mr-2" />
            Search
          </>
        )}
      </Button>

      {results.length > 0 && (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {results.map((article, index) => (
            <Card key={index} className="p-4">
              <h4 className="font-semibold mb-2">{article.title}</h4>
              <p className="text-sm text-muted-foreground mb-2">{article.summary}</p>
              {article.sources && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {article.sources.slice(0, 3).map((source: string, i: number) => (
                    <Badge key={i} variant="outline" className="text-xs">{source}</Badge>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {article.published_at && new Date(article.published_at).toLocaleDateString()}
                </span>
                <Button size="sm" onClick={() => handleSaveArticle(article)}>
                  Save & Analyze
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default NewsDiscovery;
