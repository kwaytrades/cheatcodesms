-- Add metadata fields to content_videos table for editor support
ALTER TABLE content_videos
ADD COLUMN IF NOT EXISTS title text,
ADD COLUMN IF NOT EXISTS source text DEFAULT 'recorder',
ADD COLUMN IF NOT EXISTS composition_data jsonb;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_content_videos_source ON content_videos(source);
CREATE INDEX IF NOT EXISTS idx_content_videos_user_id ON content_videos(user_id);