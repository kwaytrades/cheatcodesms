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
    const { clipId, prompt, duration = 10 } = await req.json();

    if (!clipId || !prompt) {
      throw new Error('Clip ID and prompt are required');
    }

    const projectId = Deno.env.get('GOOGLE_CLOUD_PROJECT_ID');
    const serviceAccountKey = Deno.env.get('GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY');

    if (!projectId || !serviceAccountKey) {
      throw new Error('Google Cloud credentials not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse service account key
    const credentials = JSON.parse(serviceAccountKey);

    // Get access token
    const accessToken = await getAccessToken(credentials);

    // Call Veo 3 API
    const location = 'us-central1';
    const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/veo-3.0-generate-001:predict`;

    console.log('Calling Veo API:', endpoint);

    const veoResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        instances: [{
          prompt: prompt,
        }],
        parameters: {
          sampleCount: 1,
          aspectRatio: '16:9',
          durationSeconds: duration
        }
      })
    });

    if (!veoResponse.ok) {
      const errorText = await veoResponse.text();
      console.error('Veo API error:', veoResponse.status, errorText);
      throw new Error(`Veo API error: ${veoResponse.status} - ${errorText}`);
    }

    const veoData = await veoResponse.json();
    console.log('Veo response:', JSON.stringify(veoData).substring(0, 200));

    // Extract video data (base64 or URL)
    const videoData = veoData.predictions?.[0]?.video || veoData.predictions?.[0];
    
    if (!videoData) {
      throw new Error('No video data in Veo response');
    }

    // Upload to Supabase Storage
    const fileName = `${clipId}.mp4`;
    let videoUrl;

    if (typeof videoData === 'string' && videoData.startsWith('gs://')) {
      // Google Cloud Storage URL - download and re-upload
      const gsUrl = videoData;
      const downloadUrl = gsUrl.replace('gs://', 'https://storage.googleapis.com/');
      
      const videoResponse = await fetch(downloadUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      
      const videoBlob = await videoResponse.blob();
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('content-videos')
        .upload(`ai-clips/${fileName}`, videoBlob, {
          contentType: 'video/mp4',
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('content-videos')
        .getPublicUrl(`ai-clips/${fileName}`);

      videoUrl = urlData.publicUrl;
    } else if (typeof videoData === 'string' && videoData.startsWith('data:')) {
      // Base64 data
      const base64Data = videoData.split(',')[1];
      const videoBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('content-videos')
        .upload(`ai-clips/${fileName}`, videoBuffer, {
          contentType: 'video/mp4',
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('content-videos')
        .getPublicUrl(`ai-clips/${fileName}`);

      videoUrl = urlData.publicUrl;
    } else {
      throw new Error('Unsupported video data format');
    }

    // Update clip record
    await supabase
      .from('ai_video_clips')
      .update({
        status: 'completed',
        clip_url: videoUrl,
        veo_task_id: veoData.metadata?.operationId || null
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
    console.error('Error:', error);
    
    // Update clip status to failed if clipId is available
    if (req.body) {
      try {
        const body = await req.json();
        if (body.clipId) {
          const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
          const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
          const supabase = createClient(supabaseUrl, supabaseKey);
          
          await supabase
            .from('ai_video_clips')
            .update({
              status: 'failed',
              error_message: error instanceof Error ? error.message : 'Unknown error'
            })
            .eq('id', body.clipId);
        }
      } catch (e) {
        console.error('Failed to update clip status:', e);
      }
    }

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
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
