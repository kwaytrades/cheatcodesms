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

    // Get all completed clips for this job
    const { data: clips, error: clipsError } = await supabase
      .from('ai_video_clips')
      .select('*')
      .eq('job_id', jobId)
      .eq('status', 'completed')
      .order('scene_number');

    if (clipsError) throw clipsError;

    if (!clips || clips.length === 0) {
      throw new Error('No completed clips found for this job');
    }

    console.log(`Assembling ${clips.length} clips for job ${jobId}`);

    // For now, if there's only one clip, just use that
    // In a full implementation, we'd use FFmpeg to concatenate multiple clips
    if (clips.length === 1) {
      const videoUrl = clips[0].clip_url;
      
      return new Response(
        JSON.stringify({ 
          videoUrl,
          clipCount: 1,
          message: 'Single clip video ready'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For multiple clips, we would:
    // 1. Download all clips
    // 2. Use FFmpeg to concatenate them
    // 3. Upload the final video
    // For now, return the first clip URL as a placeholder
    
    console.log('Multi-clip assembly would happen here');
    
    // Placeholder: Return first clip
    // TODO: Implement proper FFmpeg concatenation
    const videoUrl = clips[0].clip_url;

    return new Response(
      JSON.stringify({ 
        videoUrl,
        clipCount: clips.length,
        message: 'Video assembly placeholder - using first clip'
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
