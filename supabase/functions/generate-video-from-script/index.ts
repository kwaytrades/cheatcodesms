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
    const { scriptText, scriptId, targetDuration = 30, format = 'professional' } = await req.json();

    if (!scriptText) {
      throw new Error('Script text is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Create job record
    const { data: job, error: jobError } = await supabase
      .from('ai_video_jobs')
      .insert({
        user_id: user.id,
        script_id: scriptId,
        script_text: scriptText,
        status: 'analyzing',
        metadata: { targetDuration, format }
      })
      .select()
      .single();

    if (jobError) throw jobError;

    console.log('Created job:', job.id);

    // Start async processing (don't await)
    processVideoGeneration(job.id, scriptText, targetDuration, format, supabase).catch(console.error);

    return new Response(
      JSON.stringify({ 
        jobId: job.id,
        status: 'analyzing',
        message: 'Video generation started'
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

async function processVideoGeneration(
  jobId: string,
  scriptText: string,
  targetDuration: number,
  format: string,
  supabase: any
) {
  try {
    // Step 1: Analyze script into scenes
    console.log('Analyzing script...');
    const scenesResponse = await supabase.functions.invoke('analyze-script-scenes', {
      body: { scriptText, targetDuration }
    });

    if (scenesResponse.error) throw scenesResponse.error;
    const scenes = scenesResponse.data.scenes;

    await supabase
      .from('ai_video_jobs')
      .update({ 
        scene_descriptions: scenes,
        status: 'generating_prompts'
      })
      .eq('id', jobId);

    // Step 2: Generate optimized prompts
    console.log('Generating prompts...');
    const promptsResponse = await supabase.functions.invoke('generate-video-prompts', {
      body: { scenes, format }
    });

    if (promptsResponse.error) throw promptsResponse.error;
    const prompts = promptsResponse.data.prompts;

    await supabase
      .from('ai_video_jobs')
      .update({ 
        video_prompts: prompts,
        status: 'generating_clips'
      })
      .eq('id', jobId);

    // Step 3: Generate video clips
    console.log('Generating video clips...');
    console.log(`Processing ${prompts.length} prompts`);
    
    const clipPromises = prompts.map(async (prompt: any, index: number) => {
      try {
        console.log(`Creating clip ${index + 1}:`, prompt);
        
        // Create clip record
        const { data: clip, error: clipError } = await supabase
          .from('ai_video_clips')
          .insert({
            job_id: jobId,
            scene_number: index + 1,
            prompt_text: prompt.text || prompt,
            status: 'processing'
          })
          .select()
          .single();

        if (clipError) {
          console.error(`Failed to create clip ${index + 1}:`, clipError);
          throw clipError;
        }

        console.log(`Invoking generate-veo-video-clip for clip ${clip.id}`);

        // Generate clip
        const clipResponse = await supabase.functions.invoke('generate-veo-video-clip', {
          body: { 
            clipId: clip.id,
            prompt: prompt.text || prompt,
            duration: prompt.duration || 10
          }
        });

        if (clipResponse.error) {
          console.error(`Clip generation failed for ${clip.id}:`, clipResponse.error);
          throw clipResponse.error;
        }

        console.log(`Clip ${clip.id} generated successfully`);
        return clipResponse;
      } catch (error) {
        console.error(`Error in clip ${index + 1}:`, error);
        throw error;
      }
    });

    const clipResults = await Promise.all(clipPromises);
    console.log(`All ${clipResults.length} clips processed`);

    // Step 4: Assemble final video
    console.log('Assembling final video...');
    await supabase
      .from('ai_video_jobs')
      .update({ status: 'assembling' })
      .eq('id', jobId);

    const assembleResponse = await supabase.functions.invoke('assemble-video-clips', {
      body: { jobId }
    });

    if (assembleResponse.error) throw assembleResponse.error;

    // Mark as completed
    await supabase
      .from('ai_video_jobs')
      .update({ 
        status: 'completed',
        final_video_url: assembleResponse.data.videoUrl
      })
      .eq('id', jobId);

    console.log('Video generation completed:', jobId);

  } catch (error) {
    console.error('Processing error:', error);
    await supabase
      .from('ai_video_jobs')
      .update({ 
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error'
      })
      .eq('id', jobId);
  }
}
