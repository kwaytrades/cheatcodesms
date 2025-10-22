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

  let clipId: string | undefined;
  
  try {
    const body = await req.json();
    clipId = body.clipId;
    const prompt = body.prompt;
    const duration = body.duration || 8;

    if (!clipId || !prompt) {
      throw new Error('Clip ID and prompt are required');
    }

    console.log('Processing clip:', { clipId, promptLength: prompt.length, duration });

    const apiKey = Deno.env.get('GOOGLE_GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('GOOGLE_GEMINI_API_KEY not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Start video generation using Gemini API
    console.log('Starting Veo 3.1 video generation...');
    
    const generateResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-preview:generateVideos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        prompt: prompt,
        config: {
          durationSeconds: duration.toString(),
          aspectRatio: "16:9",
          resolution: "720p"
        }
      })
    });

    if (!generateResponse.ok) {
      const errorText = await generateResponse.text();
      console.error('Veo API error:', generateResponse.status, errorText);
      throw new Error(`Veo API error: ${generateResponse.status} - ${errorText}`);
    }

    const operationData = await generateResponse.json();
    const operationName = operationData.name;
    
    if (!operationName) {
      throw new Error('No operation name returned from Veo API');
    }

    console.log('Operation started:', operationName);

    // Update clip with operation ID
    await supabase
      .from('ai_video_clips')
      .update({
        veo_task_id: operationName,
        status: 'processing'
      })
      .eq('id', clipId);

    // Poll until done (with timeout)
    const maxPollingTime = 360000; // 6 minutes (max according to docs)
    const pollInterval = 10000; // 10 seconds
    const startTime = Date.now();
    
    let isDone = false;
    let videoData: any = null;

    while (!isDone && (Date.now() - startTime) < maxPollingTime) {
      console.log('Polling operation status...');
      
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      
      const statusResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/${operationName}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });

      if (!statusResponse.ok) {
        const errorText = await statusResponse.text();
        console.error('Poll error:', statusResponse.status, errorText);
        continue; // Keep trying
      }

      const statusData = await statusResponse.json();
      
      if (statusData.done) {
        isDone = true;
        console.log('Video generation complete!');
        
        if (statusData.error) {
          throw new Error(`Veo generation failed: ${JSON.stringify(statusData.error)}`);
        }
        
        videoData = statusData.response?.generatedVideos?.[0];
        
        if (!videoData?.video?.uri) {
          throw new Error('No video URI in completed operation');
        }
        
        break;
      }
      
      console.log('Operation still in progress...');
    }

    if (!videoData) {
      throw new Error('Video generation timed out after 6 minutes');
    }

    // Download video from Google
    console.log('Downloading video from:', videoData.video.uri);
    const videoResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/${videoData.video.name}?alt=media`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    if (!videoResponse.ok) {
      throw new Error(`Failed to download video: ${videoResponse.status}`);
    }

    const videoBlob = await videoResponse.blob();
    const videoBuffer = await videoBlob.arrayBuffer();

    // Upload to Supabase Storage
    const fileName = `${clipId}.mp4`;
    const { error: uploadError } = await supabase.storage
      .from('content-videos')
      .upload(`ai-clips/${fileName}`, videoBuffer, {
        contentType: 'video/mp4',
        upsert: true
      });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from('content-videos')
      .getPublicUrl(`ai-clips/${fileName}`);

    const videoUrl = urlData.publicUrl;

    // Update clip record
    await supabase
      .from('ai_video_clips')
      .update({
        status: 'completed',
        clip_url: videoUrl
      })
      .eq('id', clipId);

    console.log('Clip generated successfully:', clipId);

    return new Response(
      JSON.stringify({ 
        clipId,
        videoUrl,
        status: 'completed'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-veo-video-clip:', error);
    
    if (clipId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      await supabase
        .from('ai_video_clips')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error'
        })
        .eq('id', clipId);
    }

    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        clipId: clipId || 'unknown'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function getAccessToken(credentials: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600;

  const header = {
    alg: 'RS256',
    typ: 'JWT',
    kid: credentials.private_key_id
  };

  const claimSet = {
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    exp: expiry,
    iat: now
  };

  // Note: In production, use proper JWT signing library
  // For now, using Google's OAuth2 service account flow
  const params = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: await createJWT(header, claimSet, credentials.private_key)
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get access token: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function createJWT(header: any, payload: any, privateKey: string): Promise<string> {
  const encoder = new TextEncoder();
  
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  
  const message = `${headerB64}.${payloadB64}`;
  
  // Import private key
  const keyData = privateKey
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  
  const binaryKey = Uint8Array.from(atob(keyData), c => c.charCodeAt(0));
  
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    encoder.encode(message)
  );
  
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  
  return `${message}.${signatureB64}`;
}
