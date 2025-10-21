-- Create video_render_jobs table to track rendering status
CREATE TABLE video_render_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  progress INTEGER DEFAULT 0,
  composition_data JSONB NOT NULL,
  settings JSONB NOT NULL,
  video_url TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE video_render_jobs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own render jobs
CREATE POLICY "Users can view own render jobs"
  ON video_render_jobs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Users can create render jobs
CREATE POLICY "Users can create render jobs"
  ON video_render_jobs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Index for faster queries
CREATE INDEX idx_render_jobs_user_status ON video_render_jobs(user_id, status);
CREATE INDEX idx_render_jobs_created ON video_render_jobs(created_at DESC);

-- Enable realtime for live progress updates
ALTER PUBLICATION supabase_realtime ADD TABLE video_render_jobs;