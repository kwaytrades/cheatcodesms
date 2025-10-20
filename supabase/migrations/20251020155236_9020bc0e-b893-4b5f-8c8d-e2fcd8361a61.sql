-- Create style_guides table for content format customization
CREATE TABLE public.style_guides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  format TEXT NOT NULL, -- youtube_long, youtube_short, tiktok, carousel
  brand_voice TEXT,
  content_instructions TEXT,
  tone_preferences TEXT,
  hook_guidelines TEXT,
  cta_templates TEXT,
  additional_notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, format)
);

-- Enable RLS
ALTER TABLE public.style_guides ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own style guides"
ON public.style_guides
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own style guides"
ON public.style_guides
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own style guides"
ON public.style_guides
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own style guides"
ON public.style_guides
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_style_guides_updated_at
BEFORE UPDATE ON public.style_guides
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();