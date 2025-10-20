-- Content Studio: News Stories, Scripts, Videos, and Folders

-- news_stories table
CREATE TABLE news_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  url TEXT,
  source TEXT NOT NULL,
  viral_score INTEGER DEFAULT 50 CHECK (viral_score >= 0 AND viral_score <= 100),
  tags TEXT[],
  category TEXT,
  ai_analysis JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_news_stories_user ON news_stories(user_id);
CREATE INDEX idx_news_stories_viral ON news_stories(viral_score DESC);
CREATE INDEX idx_news_stories_created ON news_stories(created_at DESC);

ALTER TABLE news_stories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own news stories"
  ON news_stories FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own news stories"
  ON news_stories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own news stories"
  ON news_stories FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own news stories"
  ON news_stories FOR DELETE
  USING (auth.uid() = user_id);

-- content_scripts table
CREATE TABLE content_scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  story_id UUID REFERENCES news_stories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  script_text TEXT NOT NULL,
  format TEXT NOT NULL,
  length_seconds INTEGER,
  tone TEXT,
  hook_style TEXT,
  status TEXT DEFAULT 'draft',
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_content_scripts_user ON content_scripts(user_id);
CREATE INDEX idx_content_scripts_story ON content_scripts(story_id);
CREATE INDEX idx_content_scripts_status ON content_scripts(status);

ALTER TABLE content_scripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own content scripts"
  ON content_scripts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own content scripts"
  ON content_scripts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own content scripts"
  ON content_scripts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own content scripts"
  ON content_scripts FOR DELETE
  USING (auth.uid() = user_id);

-- content_videos table
CREATE TABLE content_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  script_id UUID REFERENCES content_scripts(id) ON DELETE CASCADE,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  duration_seconds INTEGER,
  take_number INTEGER DEFAULT 1,
  is_final BOOLEAN DEFAULT FALSE,
  file_size_bytes BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_content_videos_user ON content_videos(user_id);
CREATE INDEX idx_content_videos_script ON content_videos(script_id);
CREATE INDEX idx_content_videos_final ON content_videos(is_final) WHERE is_final = TRUE;

ALTER TABLE content_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own content videos"
  ON content_videos FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own content videos"
  ON content_videos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own content videos"
  ON content_videos FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own content videos"
  ON content_videos FOR DELETE
  USING (auth.uid() = user_id);

-- content_folders table
CREATE TABLE content_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  parent_folder_id UUID REFERENCES content_folders(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_content_folders_user ON content_folders(user_id);
CREATE INDEX idx_content_folders_parent ON content_folders(parent_folder_id);

ALTER TABLE content_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own content folders"
  ON content_folders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own content folders"
  ON content_folders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own content folders"
  ON content_folders FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own content folders"
  ON content_folders FOR DELETE
  USING (auth.uid() = user_id);