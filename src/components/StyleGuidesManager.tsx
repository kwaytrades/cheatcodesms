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
import { Loader2, Save, FileText, Video, Tv, Grid, Upload, Trash2 } from "lucide-react";
import { toast } from "sonner";

const FORMATS = [
  { id: 'youtube_long', name: 'YouTube Long', icon: Video },
  { id: 'youtube_short', name: 'YouTube Short', icon: Tv },
  { id: 'tiktok', name: 'TikTok/Reel', icon: Video },
  { id: 'carousel', name: 'LinkedIn Carousel', icon: Grid },
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

  const [formData, setFormData] = useState({
    brand_voice: '',
    content_instructions: '',
    tone_preferences: '',
    hook_guidelines: '',
    cta_templates: '',
    additional_notes: '',
  });

  // Update form when guide or format changes
  useEffect(() => {
    if (currentGuide) {
      setFormData({
        brand_voice: currentGuide.brand_voice || '',
        content_instructions: currentGuide.content_instructions || '',
        tone_preferences: currentGuide.tone_preferences || '',
        hook_guidelines: currentGuide.hook_guidelines || '',
        cta_templates: currentGuide.cta_templates || '',
        additional_notes: currentGuide.additional_notes || '',
      });
    } else {
      setFormData({
        brand_voice: '',
        content_instructions: '',
        tone_preferences: '',
        hook_guidelines: '',
        cta_templates: '',
        additional_notes: '',
      });
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
        // Parse the content into sections or use it as full instructions
        setFormData({
          ...formData,
          content_instructions: text,
        });
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

      if (!formData.brand_voice && !formData.content_instructions) {
        throw new Error('Please provide at least brand voice or content instructions');
      }

      const payload = {
        user_id: user.id,
        format,
        ...formData,
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
                  <Label htmlFor="file-upload">Upload Style Guide Document (Optional)</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      id="file-upload"
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
                    Upload a .txt or .md file with your complete style guide instructions
                  </p>
                </div>

                <div>
                  <Label>Brand Voice</Label>
                  <Textarea
                    value={formData.brand_voice}
                    onChange={(e) => setFormData({ ...formData, brand_voice: e.target.value })}
                    placeholder="Describe your brand's personality, tone, and communication style..."
                    className="mt-2 min-h-[100px]"
                  />
                </div>

                <div>
                  <Label>Content Instructions</Label>
                  <Textarea
                    value={formData.content_instructions}
                    onChange={(e) => setFormData({ ...formData, content_instructions: e.target.value })}
                    placeholder="Specific guidelines for how content should be structured and presented. This field will be populated if you upload a document."
                    className="mt-2 min-h-[100px]"
                  />
                </div>

                <div>
                  <Label>Tone Preferences</Label>
                  <Textarea
                    value={formData.tone_preferences}
                    onChange={(e) => setFormData({ ...formData, tone_preferences: e.target.value })}
                    placeholder="Preferred tone settings (e.g., 'Always start with urgency', 'Keep it conversational')..."
                    className="mt-2 min-h-[80px]"
                  />
                </div>

                <div>
                  <Label>Hook Guidelines</Label>
                  <Textarea
                    value={formData.hook_guidelines}
                    onChange={(e) => setFormData({ ...formData, hook_guidelines: e.target.value })}
                    placeholder="How should hooks be crafted? Any specific patterns or phrases to use/avoid..."
                    className="mt-2 min-h-[80px]"
                  />
                </div>

                <div>
                  <Label>CTA Templates</Label>
                  <Textarea
                    value={formData.cta_templates}
                    onChange={(e) => setFormData({ ...formData, cta_templates: e.target.value })}
                    placeholder="Call-to-action examples and templates (e.g., 'Join our Discord', 'Download the guide')..."
                    className="mt-2 min-h-[80px]"
                  />
                </div>

                <div>
                  <Label>Additional Notes</Label>
                  <Textarea
                    value={formData.additional_notes}
                    onChange={(e) => setFormData({ ...formData, additional_notes: e.target.value })}
                    placeholder="Any other format-specific guidelines or considerations..."
                    className="mt-2 min-h-[80px]"
                  />
                </div>

                <Button
                  onClick={() => saveGuide.mutate(format.id)}
                  disabled={saveGuide.isPending}
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
                      Save Style Guide
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
                        {guide.brand_voice || guide.content_instructions?.substring(0, 50) + '...' || 'No description'}
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
    </div>
  );
};
