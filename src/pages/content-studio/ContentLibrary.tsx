import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Grid3x3, List, FolderOpen, FileText, Video, Trash2, Loader2, Download, Scissors, Edit } from "lucide-react";
import { toast } from "sonner";
import ReactPlayer from "react-player";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const FORMATS = {
  youtube_long: { label: 'YouTube Long', color: 'bg-red-500' },
  youtube_short: { label: 'Short', color: 'bg-[#FF6B6B]' },
  tiktok: { label: 'TikTok', color: 'bg-[#00F2EA]' },
  carousel: { label: 'Carousel', color: 'bg-[#0077B5]' }
};

const STATUSES = {
  draft: { label: 'Draft', color: 'bg-gray-500' },
  scripted: { label: 'Scripted', color: 'bg-blue-500' },
  recorded: { label: 'Recorded', color: 'bg-[#A25DDC]' },
  published: { label: 'Published', color: 'bg-green-500' }
};

const ContentLibrary = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterFormat, setFilterFormat] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedVideo, setSelectedVideo] = useState<any>(null);

  // Fetch scripts
  const { data: scripts, isLoading: scriptsLoading } = useQuery({
    queryKey: ['content-scripts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('content_scripts')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch videos
  const { data: videos, isLoading: videosLoading } = useQuery({
    queryKey: ['content-videos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('content_videos')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch imported videos
  const { data: importedVideos, isLoading: importedLoading } = useQuery({
    queryKey: ['imported-videos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('imported_videos')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // Delete script mutation
  const deleteScript = useMutation({
    mutationFn: async (scriptId: string) => {
      const { error } = await supabase
        .from('content_scripts')
        .delete()
        .eq('id', scriptId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-scripts'] });
      toast.success('Script deleted');
    },
    onError: () => {
      toast.error('Failed to delete script');
    },
  });

  // Delete video mutation
  const deleteVideo = useMutation({
    mutationFn: async (videoId: string) => {
      const video = videos?.find(v => v.id === videoId);
      if (!video) return;

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('content-videos')
        .remove([video.video_url]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('content_videos')
        .delete()
        .eq('id', videoId);

      if (dbError) throw dbError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-videos'] });
      toast.success('Video deleted');
    },
    onError: () => {
      toast.error('Failed to delete video');
    },
  });

  // Delete imported video mutation
  const deleteImportedVideo = useMutation({
    mutationFn: async (videoId: string) => {
      const { error } = await supabase
        .from('imported_videos')
        .delete()
        .eq('id', videoId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['imported-videos'] });
      toast.success('Imported video deleted');
    },
    onError: () => {
      toast.error('Failed to delete imported video');
    },
  });

  // Combine scripts, videos, and imported videos into content items
  const contentItems = [
    ...(scripts?.map(script => ({
      id: script.id,
      type: 'script' as const,
      title: script.title,
      format: script.format,
      status: script.status,
      created_at: script.created_at,
      duration: script.length_seconds,
      data: script
    })) || []),
    ...(videos?.map(video => ({
      id: video.id,
      type: 'video' as const,
      title: `Video ${video.take_number}`,
      format: 'youtube_long',
      status: 'recorded' as const,
      created_at: video.created_at,
      duration: video.duration_seconds,
      data: video
    })) || []),
    ...(importedVideos?.map(video => ({
      id: video.id,
      type: 'imported' as const,
      title: video.title,
      format: video.platform,
      status: 'imported' as const,
      created_at: video.created_at,
      duration: video.duration_seconds,
      data: video
    })) || [])
  ];

  // Apply filters
  const filteredItems = contentItems.filter(item => {
    if (searchQuery && !item.title.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (filterFormat !== 'all' && item.format !== filterFormat) {
      return false;
    }
    if (filterStatus !== 'all' && item.status !== filterStatus) {
      return false;
    }
    return true;
  });

  const handlePlayVideo = async (video: any) => {
    // Get a signed URL since the bucket is private
    const { data, error } = await supabase.storage
      .from('content-videos')
      .createSignedUrl(video.video_url, 3600); // 1 hour expiry
    
    if (error) {
      toast.error('Failed to load video');
      return;
    }
    
    setSelectedVideo({ ...video, signedUrl: data.signedUrl });
  };

  const handleExportVideo = async (video: any) => {
    try {
      const { data, error } = await supabase.storage
        .from('content-videos')
        .download(video.video_url);
      
      if (error) throw error;

      // Create blob URL and trigger download
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `video-${video.id}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success('Video download started');
    } catch (error) {
      toast.error('Failed to export video');
    }
  };

  const isLoading = scriptsLoading || videosLoading || importedLoading;

  return (
    <div className="h-full flex gap-6 p-6 overflow-hidden">
      {/* LEFT SIDEBAR - Filters */}
      <div className="w-64 flex-none space-y-4 overflow-y-auto">
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Folders</h3>
          <div className="space-y-2">
            <Button variant="ghost" className="w-full justify-start">
              <FolderOpen className="h-4 w-4 mr-2" />
              All Content
            </Button>
            <Button variant="ghost" className="w-full justify-start">
              📰 Trending News
            </Button>
            <Button variant="ghost" className="w-full justify-start">
              🎓 Educational
            </Button>
            <Button variant="ghost" className="w-full justify-start">
              🎬 Shorts
            </Button>
            <Button variant="ghost" className="w-full justify-start">
              📊 Carousels
            </Button>
          </div>
        </Card>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Filter Bar */}
        <div className="flex-none mb-4 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search content..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={filterFormat} onValueChange={setFilterFormat}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Format" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Formats</SelectItem>
              {Object.entries(FORMATS).map(([value, { label }]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {Object.entries(STATUSES).map(([value, { label }]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex border rounded-lg">
            <Button
              size="sm"
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              onClick={() => setViewMode('grid')}
            >
              <Grid3x3 className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content Grid/List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredItems.length > 0 ? (
            viewMode === 'grid' ? (
              <div className="grid grid-cols-3 gap-4">
                {filteredItems.map((item) => (
                  <Card key={item.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                    <div className="aspect-video bg-muted flex items-center justify-center relative">
                      {item.type === 'video' ? (
                        <Video className="h-12 w-12 text-muted-foreground" />
                      ) : (
                        <FileText className="h-12 w-12 text-muted-foreground" />
                      )}
                      <Badge className={`absolute top-2 right-2 ${FORMATS[item.format as keyof typeof FORMATS]?.color}`}>
                        {FORMATS[item.format as keyof typeof FORMATS]?.label}
                      </Badge>
                      <Badge className={`absolute top-2 left-2 ${STATUSES[item.status as keyof typeof STATUSES]?.color}`}>
                        {STATUSES[item.status as keyof typeof STATUSES]?.label}
                      </Badge>
                    </div>
                    <div className="p-4">
                      <h4 className="font-semibold truncate mb-2">{item.title}</h4>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{new Date(item.created_at).toLocaleDateString()}</span>
                        {item.duration && <span>{Math.floor(item.duration / 60)}:{(item.duration % 60).toString().padStart(2, '0')}</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        {item.type === 'video' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              onClick={() => handlePlayVideo(item.data)}
                            >
                              <Video className="h-3 w-3 mr-1" />
                              Play
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigate('/content-studio/editor', { state: { video: item.data } })}
                              title="Edit video"
                            >
                              <Scissors className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleExportVideo(item.data)}
                            >
                              <Download className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                        {item.type === 'imported' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              onClick={() => window.open(item.data.external_url, '_blank')}
                            >
                              <Video className="h-3 w-3 mr-1" />
                              View
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigate('/content-studio/scripts', { 
                                state: { transcript: item.data.transcript }
                              })}
                              title="Create script from transcript"
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (item.type === 'script') {
                              deleteScript.mutate(item.id);
                            } else if (item.type === 'video') {
                              deleteVideo.mutate(item.id);
                            } else {
                              deleteImportedVideo.mutate(item.id);
                            }
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredItems.map((item) => (
                  <Card key={item.id} className="p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-4">
                      <div className="flex-none w-16 h-16 bg-muted rounded flex items-center justify-center">
                        {item.type === 'video' ? (
                          <Video className="h-6 w-6 text-muted-foreground" />
                        ) : (
                          <FileText className="h-6 w-6 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold truncate">{item.title}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={FORMATS[item.format as keyof typeof FORMATS]?.color}>
                            {FORMATS[item.format as keyof typeof FORMATS]?.label}
                          </Badge>
                          <Badge className={STATUSES[item.status as keyof typeof STATUSES]?.color}>
                            {STATUSES[item.status as keyof typeof STATUSES]?.label}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex-none text-sm text-muted-foreground">
                        {new Date(item.created_at).toLocaleDateString()}
                      </div>
                      {item.duration && (
                        <div className="flex-none text-sm text-muted-foreground">
                          {Math.floor(item.duration / 60)}:{(item.duration % 60).toString().padStart(2, '0')}
                        </div>
                      )}
                      <div className="flex-none flex items-center gap-2">
                        {item.type === 'video' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handlePlayVideo(item.data)}
                            >
                              <Video className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigate('/content-studio/editor', { state: { video: item.data } })}
                              title="Edit video"
                            >
                              <Scissors className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleExportVideo(item.data)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {item.type === 'imported' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(item.data.external_url, '_blank')}
                            >
                              <Video className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigate('/content-studio/scripts', { 
                                state: { transcript: item.data.transcript }
                              })}
                              title="Create script"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (item.type === 'script') {
                              deleteScript.mutate(item.id);
                            } else if (item.type === 'video') {
                              deleteVideo.mutate(item.id);
                            } else {
                              deleteImportedVideo.mutate(item.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <FolderOpen className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">No content found</p>
              <p className="text-sm">Create your first script or record a video to get started</p>
            </div>
          )}
        </div>
      </div>

      {/* Video Player Dialog */}
      <Dialog open={!!selectedVideo} onOpenChange={() => setSelectedVideo(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Video Player</DialogTitle>
          </DialogHeader>
          {selectedVideo && (
            <div className="space-y-4">
              <div className="aspect-video bg-black rounded-lg overflow-hidden">
                <ReactPlayer
                  url={selectedVideo.signedUrl}
                  controls
                  width="100%"
                  height="100%"
                  playing
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Duration: {Math.floor(selectedVideo.duration_seconds / 60)}:{(selectedVideo.duration_seconds % 60).toString().padStart(2, '0')}
                </div>
                <Button
                  variant="outline"
                  onClick={() => handleExportVideo(selectedVideo)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Video
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ContentLibrary;
