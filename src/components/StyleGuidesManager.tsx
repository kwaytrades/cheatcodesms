import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Save, FileText, Video, Tv, Grid } from "lucide-react";
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

  const { data: styleGuides, isLoading } = useQuery({
    queryKey: ['style-guides'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('style_guides')
        .select('*')
        .eq('user_id', user.id);

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

  // Update form when guide changes
  useState(() => {
    if (currentGuide) {
      setFormData({
        brand_voice: currentGuide.brand_voice || '',
        content_instructions: currentGuide.content_instructions || '',
        tone_preferences: currentGuide.tone_preferences || '',
        hook_guidelines: currentGuide.hook_guidelines || '',
        cta_templates: currentGuide.cta_templates || '',
        additional_notes: currentGuide.additional_notes || '',
      });
    }
  });

  const saveGuide = useMutation({
    mutationFn: async (format: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

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
      toast.error('Failed to save style guide');
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
    <Card className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Content Style Guides</h2>
        <p className="text-muted-foreground mt-1">
          Customize your brand voice and content guidelines for each format
        </p>
      </div>

      <Tabs value={activeFormat} onValueChange={setActiveFormat}>
        <TabsList className="grid w-full grid-cols-4 mb-6">
          {FORMATS.map(format => {
            const Icon = format.icon;
            return (
              <TabsTrigger key={format.id} value={format.id} className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                {format.name}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {FORMATS.map(format => (
          <TabsContent key={format.id} value={format.id} className="space-y-4">
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
                placeholder="Specific guidelines for how content should be structured and presented..."
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
    </Card>
  );
};
