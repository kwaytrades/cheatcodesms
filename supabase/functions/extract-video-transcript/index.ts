import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPADATA_API_KEY = Deno.env.get('SUPADATA_API_KEY');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, platform } = await req.json();

    console.log('Extracting transcript from:', { url, platform });
    console.log('SUPADATA_API_KEY available:', !!SUPADATA_API_KEY);
    console.log('SUPADATA_API_KEY length:', SUPADATA_API_KEY?.length || 0);
    
    if (!SUPADATA_API_KEY) {
      throw new Error('SUPADATA_API_KEY environment variable is not set');
    }

    if (!url || !platform) {
      throw new Error('URL and platform are required');
    }

    // Validate platform
    const validPlatforms = ['youtube', 'tiktok', 'instagram'];
    if (!validPlatforms.includes(platform)) {
      throw new Error('Invalid platform. Must be youtube, tiktok, or instagram');
    }

    // Handle Instagram - not supported yet
    if (platform === 'instagram') {
      throw new Error('Instagram transcript extraction coming soon. Please use YouTube or TikTok for now.');
    }

    // Extract transcript using Supadata API
    let transcript = '';
    let title = '';
    let thumbnail = '';
    let duration = 0;

    if (platform === 'youtube') {
      const videoId = extractYouTubeVideoId(url);
      if (!videoId) {
        throw new Error('Invalid YouTube URL');
      }

      console.log('Calling Supadata API for YouTube video:', videoId);

      // Encode the URL for the query parameter
      const encodedUrl = encodeURIComponent(url);
      const apiUrl = `https://api.supadata.ai/v1/transcript?url=${encodedUrl}&text=true&mode=auto`;

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'x-api-key': SUPADATA_API_KEY,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Supadata API error:', response.status, errorText);
        
        if (response.status === 404) {
          throw new Error('This video doesn\'t have captions/transcript available');
        } else if (response.status === 403) {
          throw new Error('Unable to access private video');
        } else if (response.status === 429) {
          throw new Error('Too many requests, please try again later');
        } else if (response.status === 402) {
          throw new Error('API quota exceeded. Please contact support.');
        }
        
        throw new Error('Failed to extract transcript');
      }

      const data = await response.json();
      
      if (!data.content) {
        throw new Error('No transcript found for this video');
      }

      transcript = data.content;
      title = `YouTube Video ${videoId}`;
      duration = 0; // Duration not provided by Supadata API
      thumbnail = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

    } else if (platform === 'tiktok') {
      console.log('Calling Supadata API for TikTok video');

      // Encode the URL for the query parameter
      const encodedUrl = encodeURIComponent(url);
      const apiUrl = `https://api.supadata.ai/v1/transcript?url=${encodedUrl}&text=true&mode=auto`;

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'x-api-key': SUPADATA_API_KEY,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Supadata API error:', response.status, errorText);
        
        if (response.status === 404) {
          throw new Error('This video doesn\'t have captions/transcript available');
        } else if (response.status === 403) {
          throw new Error('Unable to access private video');
        } else if (response.status === 429) {
          throw new Error('Too many requests, please try again later');
        } else if (response.status === 402) {
          throw new Error('API quota exceeded. Please contact support.');
        }
        
        throw new Error('Failed to extract transcript');
      }

      const data = await response.json();
      
      if (!data.content) {
        throw new Error('No transcript found for this video');
      }

      transcript = data.content;
      title = 'TikTok Video';
      duration = 0; // Duration not provided by Supadata API
      thumbnail = '';
    }

    console.log('Transcription completed successfully');

    return new Response(
      JSON.stringify({
        transcript,
        title,
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