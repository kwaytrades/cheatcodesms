-- Create ai_video_jobs table for tracking video generation jobs
CREATE TABLE public.ai_video_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  script_id UUID REFERENCES public.content_scripts(id),
  status TEXT NOT NULL DEFAULT 'analyzing' CHECK (status IN ('analyzing', 'generating_prompts', 'generating_clips', 'assembling', 'completed', 'failed')),
  script_text TEXT NOT NULL,
  scene_descriptions JSONB DEFAULT '[]'::jsonb,
  video_prompts JSONB DEFAULT '[]'::jsonb,
  clip_urls JSONB DEFAULT '[]'::jsonb,
  final_video_url TEXT,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create ai_video_clips table for individual video clips
CREATE TABLE public.ai_video_clips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.ai_video_jobs(id) ON DELETE CASCADE,
  scene_number INTEGER NOT NULL,
  prompt_text TEXT NOT NULL,
  veo_task_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  clip_url TEXT,
  duration_seconds INTEGER DEFAULT 10,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_video_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_video_clips ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_video_jobs
CREATE POLICY "Users can view their own video jobs"
ON public.ai_video_jobs FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own video jobs"
ON public.ai_video_jobs FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own video jobs"
ON public.ai_video_jobs FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own video jobs"
ON public.ai_video_jobs FOR DELETE
USING (auth.uid() = user_id);

-- RLS Policies for ai_video_clips
CREATE POLICY "Users can view clips from their jobs"
ON public.ai_video_clips FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.ai_video_jobs
    WHERE ai_video_jobs.id = ai_video_clips.job_id
    AND ai_video_jobs.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create clips for their jobs"
ON public.ai_video_clips FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.ai_video_jobs
    WHERE ai_video_jobs.id = ai_video_clips.job_id
    AND ai_video_jobs.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update clips from their jobs"
ON public.ai_video_clips FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.ai_video_jobs
    WHERE ai_video_jobs.id = ai_video_clips.job_id
    AND ai_video_jobs.user_id = auth.uid()
  )
);

-- Create indexes for performance
CREATE INDEX idx_ai_video_jobs_user_id ON public.ai_video_jobs(user_id);
CREATE INDEX idx_ai_video_jobs_status ON public.ai_video_jobs(status);
CREATE INDEX idx_ai_video_clips_job_id ON public.ai_video_clips(job_id);
CREATE INDEX idx_ai_video_clips_status ON public.ai_video_clips(status);

-- Trigger for updated_at
CREATE TRIGGER update_ai_video_jobs_updated_at
BEFORE UPDATE ON public.ai_video_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ai_video_clips_updated_at
BEFORE UPDATE ON public.ai_video_clips
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();