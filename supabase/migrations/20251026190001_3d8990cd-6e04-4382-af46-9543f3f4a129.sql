-- Create imported_videos table for storing imported video content
CREATE TABLE public.imported_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  external_url TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('tiktok', 'instagram', 'youtube')),
  title TEXT,
  thumbnail_url TEXT,
  transcript TEXT,
  duration_seconds INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.imported_videos ENABLE ROW LEVEL SECURITY;

-- RLS Policies for imported_videos
CREATE POLICY "Users can view their own imported videos"
ON public.imported_videos
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own imported videos"
ON public.imported_videos
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own imported videos"
ON public.imported_videos
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own imported videos"
ON public.imported_videos
FOR DELETE
USING (auth.uid() = user_id);

-- Add index for better query performance
CREATE INDEX idx_imported_videos_user_id ON public.imported_videos(user_id);
CREATE INDEX idx_imported_videos_created_at ON public.imported_videos(created_at DESC);