import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, FileText, Video, Tv, Grid, Upload, Trash2, Plus, Edit2, X } from "lucide-react";
import { toast } from "sonner";

const FORMATS = [
  { id: 'youtube_long', name: 'YouTube Long', icon: Video },
  { id: 'youtube_short', name: 'YouTube Short', icon: Tv },
  { id: 'tiktok', name: 'TikTok/Reel', icon: Video },
  { id: 'carousel', name: 'X Thread', icon: Grid },
];

export const StyleGuidesManager = () => {
  const queryClient = useQueryClient();
  const [activeFormat, setActiveFormat] = useState('youtube_long');
  const [uploading, setUploading] = useState(false);

  const { data: styleGuides, isLoading } = useQuery({
    queryKey: ['style-guides'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('style_guides')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const currentGuide = styleGuides?.find(g => g.format === activeFormat);

  const [instructions, setInstructions] = useState('');
  const [fileName, setFileName] = useState('');
  const [tonePresets, setTonePresets] = useState<Array<{name: string; label: string; instructions: string}>>([]);
  const [editingTone, setEditingTone] = useState<{name: string; label: string; instructions: string} | null>(null);
  const [isAddingTone, setIsAddingTone] = useState(false);

  // Update form when guide or format changes
  useEffect(() => {
    if (currentGuide) {
      setInstructions(currentGuide.instructions || '');
      setFileName(currentGuide.file_name || '');
      setTonePresets((currentGuide.tone_presets as any) || []);
    } else {
      setInstructions('');
      setFileName('');
      setTonePresets([]);
    }
  }, [currentGuide, activeFormat]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // Read file content if it's text-based
      if (file.type.startsWith("text/") || file.name.endsWith(".txt") || file.name.endsWith(".md")) {
        const text = await file.text();
        setInstructions(text);
        setFileName(file.name);
        toast.success("Style guide loaded from file");
      } else {
        toast.error("Only text files (.txt, .md) are supported");
      }
    } catch (error: any) {
      toast.error("Failed to read file: " + error.message);
    } finally {
      setUploading(false);
      // Reset file input
      e.target.value = '';
    }
  };

  const saveGuide = useMutation({
    mutationFn: async (format: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (!instructions.trim()) {
        throw new Error('Please provide style guide instructions');
      }

      const payload = {
        user_id: user.id,
        format,
        instructions,
        file_name: fileName,
        tone_presets: tonePresets,
        is_active: true,
      };

      const { error } = await supabase
        .from('style_guides')
        .upsert(payload, { onConflict: 'user_id,format' });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['style-guides'] });
      toast.success('Style guide saved');
    },
    onError: (error) => {
      console.error('Save error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save style guide');
    },
  });

  const deleteGuide = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('style_guides')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['style-guides'] });
      toast.success('Style guide deleted');
    },
    onError: (error) => {
      console.error('Delete error:', error);
      toast.error('Failed to delete style guide');
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Content Style Guides</CardTitle>
          <CardDescription>
            Upload style guide documents or manually configure your brand voice and content guidelines for each format
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeFormat} onValueChange={setActiveFormat}>
            <TabsList className="grid w-full grid-cols-4 mb-6">
              {FORMATS.map(format => {
                const Icon = format.icon;
                const hasGuide = styleGuides?.some(g => g.format === format.id);
                return (
                  <TabsTrigger key={format.id} value={format.id} className="flex items-center gap-2 relative">
                    <Icon className="h-4 w-4" />
                    {format.name}
                    {hasGuide && <span className="absolute top-1 right-1 h-2 w-2 bg-green-500 rounded-full" />}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {FORMATS.map(format => (
              <TabsContent key={format.id} value={format.id} className="space-y-4">
                <div>
                  <Label htmlFor={`file-upload-${format.id}`}>Upload Style Guide Document</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      id={`file-upload-${format.id}`}
                      type="file"
                      onChange={handleFileUpload}
                      disabled={uploading}
                      accept=".txt,.md"
                      className="cursor-pointer"
                    />
                    <Button type="button" size="icon" disabled={uploading}>
                      <Upload className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Upload a .txt or .md file with your complete style guide (brand voice, tone, hooks, CTAs, etc.)
                  </p>
                  {fileName && (
                    <p className="text-xs text-green-600 mt-1">
                      Loaded: {fileName}
                    </p>
                  )}
                </div>

                <div>
                  <Label>Style Guide Instructions</Label>
                  <Textarea
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    placeholder={`Paste or edit your complete ${format.name} style guide here. Include:

- Brand voice and personality
- Tone guidelines 
- Hook patterns and examples
- Content structure requirements
- CTA templates
- What to avoid
- Any format-specific requirements

This will override the default AI instructions when generating scripts.`}
                    className="mt-2 min-h-[400px] font-mono text-sm"
                  />
                </div>

                {/* Tone Presets Section */}
                <div className="space-y-4 pt-6 border-t">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base">Custom Tone Presets (Optional)</Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Define specific tone variations for this format
                      </p>
                    </div>
                    {tonePresets.length > 0 && (
                      <Badge variant="secondary">{tonePresets.length} tone{tonePresets.length !== 1 ? 's' : ''}</Badge>
                    )}
                  </div>

                  {tonePresets.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Label</TableHead>
                          <TableHead className="w-[100px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tonePresets.map((preset, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-mono text-sm">{preset.name}</TableCell>
                            <TableCell>{preset.label}</TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setEditingTone(preset)}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setTonePresets(tonePresets.filter((_, i) => i !== idx));
                                    toast.success('Tone preset removed');
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4 border rounded-md">
                      No custom tones defined. Using default tones.
                    </p>
                  )}

                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditingTone({ name: '', label: '', instructions: '' });
                      setIsAddingTone(true);
                    }}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Tone Preset
                  </Button>
                </div>

                <Button
                  onClick={() => saveGuide.mutate(format.id)}
                  disabled={saveGuide.isPending || !instructions.trim()}
                  className="w-full"
                >
                  {saveGuide.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Style Guide for {format.name}
                    </>
                  )}
                </Button>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Saved Style Guides</CardTitle>
          <CardDescription>
            {styleGuides?.length || 0} format-specific style guides configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : styleGuides && styleGuides.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Format</TableHead>
                  <TableHead>Brand Voice</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {styleGuides.map((guide) => {
                  const format = FORMATS.find(f => f.id === guide.format);
                  const Icon = format?.icon || FileText;
                  return (
                    <TableRow key={guide.id}>
                      <TableCell className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        {format?.name || guide.format}
                      </TableCell>
                      <TableCell className="max-w-md truncate">
                        {guide.file_name || (guide.instructions?.substring(0, 50) + '...') || 'No description'}
                      </TableCell>
                      <TableCell>
                        {new Date(guide.updated_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteGuide.mutate(guide.id)}
                          disabled={deleteGuide.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              No style guides yet. Configure your first style guide above.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Tone Dialog */}
      <Dialog open={!!editingTone} onOpenChange={(open) => !open && setEditingTone(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isAddingTone ? 'Add' : 'Edit'} Tone Preset</DialogTitle>
            <DialogDescription>
              Define a custom tone variation for your scripts
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tone-label">Display Label</Label>
              <Input
                id="tone-label"
                placeholder="e.g., Kway Direct"
                value={editingTone?.label || ''}
                onChange={(e) => setEditingTone(prev => prev ? { ...prev, label: e.target.value } : null)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tone-name">Name (slug)</Label>
              <Input
                id="tone-name"
                placeholder="e.g., kway_direct"
                value={editingTone?.name || ''}
                onChange={(e) => {
                  const slug = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_');
                  setEditingTone(prev => prev ? { ...prev, name: slug } : null);
                }}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Auto-sanitized: lowercase, underscores only
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tone-instructions">Tone Instructions</Label>
              <Textarea
                id="tone-instructions"
                placeholder="Direct, confident, no-BS educator. Use short punchy sentences. High info density every 10-15 seconds..."
                value={editingTone?.instructions || ''}
                onChange={(e) => setEditingTone(prev => prev ? { ...prev, instructions: e.target.value } : null)}
                rows={6}
                className="font-mono text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTone(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!editingTone?.name || !editingTone?.label || !editingTone?.instructions) {
                  toast.error('All fields are required');
                  return;
                }
                
                const isDuplicate = tonePresets.some((p, i) => 
                  p.name === editingTone.name && (!isAddingTone || tonePresets[i] !== editingTone)
                );
                
                if (isDuplicate) {
                  toast.error(`Tone name "${editingTone.name}" already exists`);
                  return;
                }

                if (isAddingTone) {
                  setTonePresets([...tonePresets, editingTone]);
                  toast.success('Tone preset added');
                } else {
                  const idx = tonePresets.findIndex(p => p.name === editingTone.name);
                  if (idx >= 0) {
                    const updated = [...tonePresets];
                    updated[idx] = editingTone;
                    setTonePresets(updated);
                    toast.success('Tone preset updated');
                  }
                }
                setEditingTone(null);
                setIsAddingTone(false);
              }}
            >
              {isAddingTone ? 'Add' : 'Update'} Tone
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
