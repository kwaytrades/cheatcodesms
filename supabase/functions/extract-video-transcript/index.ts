import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ASSEMBLYAI_API_KEY = Deno.env.get('ASSEMBLYAI_API_KEY');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, platform } = await req.json();

    console.log('Extracting transcript from:', { url, platform });

    if (!url || !platform) {
      throw new Error('URL and platform are required');
    }

    // Validate platform
    const validPlatforms = ['youtube', 'tiktok', 'instagram'];
    if (!validPlatforms.includes(platform)) {
      throw new Error('Invalid platform. Must be youtube, tiktok, or instagram');
    }

    // Step 1: Submit video URL to AssemblyAI for transcription
    const uploadResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        'Authorization': ASSEMBLYAI_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: url,
        language_code: 'en'
      })
    });

    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.text();
      console.error('AssemblyAI upload error:', errorData);
      throw new Error('Failed to submit video for transcription');
    }

    const uploadData = await uploadResponse.json();
    const transcriptId = uploadData.id;

    console.log('Transcription started:', transcriptId);

    // Step 2: Poll for completion
    let transcript = null;
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max (5s intervals)

    while (attempts < maxAttempts) {
      const statusResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
        headers: {
          'Authorization': ASSEMBLYAI_API_KEY!,
        }
      });

      const statusData = await statusResponse.json();
      
      console.log('Transcription status:', statusData.status);

      if (statusData.status === 'completed') {
        transcript = statusData.text;
        break;
      } else if (statusData.status === 'error') {
        throw new Error(`Transcription failed: ${statusData.error}`);
      }

      // Wait 5 seconds before next poll
      await new Promise(resolve => setTimeout(resolve, 5000));
      attempts++;
    }

    if (!transcript) {
      throw new Error('Transcription timeout - video too long or processing failed');
    }

    // Extract metadata based on platform
    let title = '';
    let thumbnail = '';
    let duration = 0;

    // For YouTube, we can extract metadata
    if (platform === 'youtube') {
      const videoId = extractYouTubeVideoId(url);
      if (videoId) {
        title = `YouTube Video ${videoId}`;
        thumbnail = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
      }
    } else if (platform === 'tiktok') {
      title = 'TikTok Video';
    } else if (platform === 'instagram') {
      title = 'Instagram Video';
    }

    console.log('Transcription completed successfully');

    return new Response(
      JSON.stringify({
        transcript,
        title: title || `${platform} Video`,
        thumbnail,
        duration,
        platform
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error in extract-video-transcript function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to extract transcript'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
    /youtube\.com\/embed\/([^&\n?#]+)/,
    /youtube\.com\/v\/([^&\n?#]+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}