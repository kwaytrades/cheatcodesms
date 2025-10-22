// Temporary type definitions for video_render_jobs table
// This file can be removed once Supabase regenerates types

export interface VideoRenderJob {
  id: string;
  user_id: string;
  status: 'queued' | 'rendering' | 'completed' | 'failed';
  composition_data: any;
  settings: any;
  video_url: string | null;
  progress: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface VideoRenderJobInsert {
  user_id: string;
  status: string;
  composition_data: any;
  settings: any;
  progress: number;
}
