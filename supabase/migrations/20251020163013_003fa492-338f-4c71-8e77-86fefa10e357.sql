-- Create video_projects table for editing sessions
CREATE TABLE IF NOT EXISTS public.video_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  source_video_id UUID REFERENCES public.content_videos(id) ON DELETE SET NULL,
  project_name TEXT NOT NULL,
  timeline_data JSONB DEFAULT '{"tracks": [], "textLayers": [], "filters": {}}'::jsonb,
  duration_seconds INTEGER,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'processing', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.video_projects ENABLE ROW LEVEL SECURITY;

-- Users can view their own video projects
CREATE POLICY "Users can view their own video projects"
  ON public.video_projects
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own video projects
CREATE POLICY "Users can insert their own video projects"
  ON public.video_projects
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own video projects
CREATE POLICY "Users can update their own video projects"
  ON public.video_projects
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own video projects
CREATE POLICY "Users can delete their own video projects"
  ON public.video_projects
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_video_projects_user_id ON public.video_projects(user_id);

-- Update timestamp trigger
CREATE TRIGGER update_video_projects_updated_at
  BEFORE UPDATE ON public.video_projects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();