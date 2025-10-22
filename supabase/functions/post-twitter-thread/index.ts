const TWITTER_ACCESS_TOKEN = Deno.env.get("TWITTER_ACCESS_TOKEN")?.trim();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function validateEnvironmentVariables() {
  if (!TWITTER_ACCESS_TOKEN) throw new Error("Missing TWITTER_ACCESS_TOKEN environment variable");
}

function getBearerToken(): string {
  return `Bearer ${TWITTER_ACCESS_TOKEN}`;
}

async function uploadMedia(imageData: string): Promise<string> {
  const url = "https://upload.twitter.com/1.1/media/upload.json";

  // Convert base64 to binary
  const base64Data = imageData.split(',')[1];
  const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

  const formData = new FormData();
  formData.append('media', new Blob([binaryData]));

  const response = await fetch(url, {
    method: "POST",
    headers: { 
      Authorization: getBearerToken()
    },
    body: formData,
  });

  const responseText = await response.text();
  console.log("Media upload response:", responseText);

  if (!response.ok) {
    throw new Error(`Media upload failed: ${response.status} - ${responseText}`);
  }

  const result = JSON.parse(responseText);
  return result.media_id_string;
}

async function sendTweet(text: string, mediaIds?: string[], replyToId?: string): Promise<any> {
  const url = "https://api.x.com/2/tweets";
  
  const params: any = { text };
  if (mediaIds && mediaIds.length > 0) {
    params.media = { media_ids: mediaIds };
  }
  if (replyToId) {
    params.reply = { in_reply_to_tweet_id: replyToId };
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: getBearerToken(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  const responseText = await response.text();
  console.log("Tweet response:", responseText);

  if (!response.ok) {
    throw new Error(`Tweet failed: ${response.status} - ${responseText}`);
  }

  return JSON.parse(responseText);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    validateEnvironmentVariables();
    
    const { slides } = await req.json();
    
    if (!slides || !Array.isArray(slides)) {
      throw new Error("Invalid slides data");
    }

    console.log(`Starting thread with ${slides.length} tweets`);

    let previousTweetId: string | undefined;
    const results = [];

    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      console.log(`Processing slide ${i + 1}/${slides.length}`);

      // Upload media if present
      let mediaIds: string[] | undefined;
      if (slide.imageData) {
        try {
          const mediaId = await uploadMedia(slide.imageData);
          mediaIds = [mediaId];
          console.log(`Media uploaded for slide ${i + 1}: ${mediaId}`);
        } catch (error) {
          console.error(`Failed to upload media for slide ${i + 1}:`, error);
          // Continue without image
        }
      }

      // Post tweet
      const tweetText = `${i + 1}/${slides.length}\n\n${slide.text}`;
      const result = await sendTweet(tweetText, mediaIds, previousTweetId);
      
      previousTweetId = result.data.id;
      results.push(result);
      
      console.log(`Tweet ${i + 1} posted: ${result.data.id}`);

      // Small delay to avoid rate limits
      if (i < slides.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        thread_id: results[0].data.id,
        tweets: results,
        message: `Successfully posted ${results.length} tweets!`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error posting thread:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
