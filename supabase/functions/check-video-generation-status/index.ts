import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { jobId } = await req.json();

    if (!jobId) {
      throw new Error('Job ID is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get job details
    const { data: job, error: jobError } = await supabase
      .from('ai_video_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError) throw jobError;

    // Get clips status
    const { data: clips, error: clipsError } = await supabase
      .from('ai_video_clips')
      .select('*')
      .eq('job_id', jobId)
      .order('scene_number');

    if (clipsError) throw clipsError;

    const totalClips = clips?.length || 0;
    const completedClips = clips?.filter(c => c.status === 'completed').length || 0;
    const failedClips = clips?.filter(c => c.status === 'failed').length || 0;

    // Calculate progress
    let progress = 0;
    if (job.status === 'analyzing') progress = 10;
    else if (job.status === 'generating_prompts') progress = 20;
    else if (job.status === 'generating_clips') {
      progress = 30 + (completedClips / Math.max(totalClips, 1)) * 50;
    }
    else if (job.status === 'assembling') progress = 90;
    else if (job.status === 'completed') progress = 100;
    else if (job.status === 'failed') progress = 0;

    // Estimate time remaining (rough estimate)
    let estimatedTimeRemaining = 0;
    if (job.status === 'generating_clips') {
      const remainingClips = totalClips - completedClips;
      estimatedTimeRemaining = remainingClips * 30; // ~30 seconds per clip
    } else if (job.status === 'assembling') {
      estimatedTimeRemaining = 10;
    }

    return new Response(
      JSON.stringify({
        jobId: job.id,
        status: job.status,
        progress: Math.round(progress),
        scenes_total: totalClips,
        scenes_completed: completedClips,
        scenes_failed: failedClips,
        clips: clips?.map(c => ({
          scene: c.scene_number,
          status: c.status,
          url: c.clip_url
        })),
        final_video_url: job.final_video_url,
        error_message: job.error_message,
        estimated_time_remaining: estimatedTimeRemaining,
        created_at: job.created_at
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
