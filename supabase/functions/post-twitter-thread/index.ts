import { createHmac } from "node:crypto";

const API_KEY = Deno.env.get("TWITTER_CONSUMER_KEY")?.trim();
const API_SECRET = Deno.env.get("TWITTER_CONSUMER_SECRET")?.trim();
const ACCESS_TOKEN = Deno.env.get("TWITTER_ACCESS_TOKEN")?.trim();
const ACCESS_TOKEN_SECRET = Deno.env.get("TWITTER_ACCESS_TOKEN_SECRET")?.trim();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function validateEnvironmentVariables() {
  console.log("🔍 Validating Twitter credentials...");
  
  if (!API_KEY) throw new Error("Missing TWITTER_CONSUMER_KEY environment variable");
  if (!API_SECRET) throw new Error("Missing TWITTER_CONSUMER_SECRET environment variable");
  if (!ACCESS_TOKEN) throw new Error("Missing TWITTER_ACCESS_TOKEN environment variable");
  if (!ACCESS_TOKEN_SECRET) throw new Error("Missing TWITTER_ACCESS_TOKEN_SECRET environment variable");
  
  // Log masked versions to verify credentials are being read
  console.log("✅ All credentials found:");
  console.log(`  - Consumer Key: ${API_KEY.substring(0, 5)}...${API_KEY.substring(API_KEY.length - 4)}`);
  console.log(`  - Consumer Secret: ${API_SECRET.substring(0, 5)}...${API_SECRET.substring(API_SECRET.length - 4)}`);
  console.log(`  - Access Token: ${ACCESS_TOKEN.substring(0, 5)}...${ACCESS_TOKEN.substring(ACCESS_TOKEN.length - 4)}`);
  console.log(`  - Access Token Secret: ${ACCESS_TOKEN_SECRET.substring(0, 5)}...${ACCESS_TOKEN_SECRET.substring(ACCESS_TOKEN_SECRET.length - 4)}`);
}

function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string
): string {
  const paramString = Object.entries(params)
    .sort()
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  
  const signatureBaseString = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(paramString)}`;
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
  
  console.log("🔒 Signature generation:");
  console.log(`  - Base string length: ${signatureBaseString.length}`);
  console.log(`  - Signing key length: ${signingKey.length}`);
  
  const hmacSha1 = createHmac("sha1", signingKey);
  const signature = hmacSha1.update(signatureBaseString).digest("base64");
  
  console.log(`  - Generated signature: ${signature.substring(0, 10)}...`);
  
  return signature;
}

function generateOAuthHeader(method: string, url: string): string {
  console.log(`🔐 Generating OAuth header for ${method} ${url}`);
  
  const oauthParams = {
    oauth_consumer_key: API_KEY!,
    oauth_nonce: Math.random().toString(36).substring(2),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: ACCESS_TOKEN!,
    oauth_version: "1.0",
  };

  console.log("OAuth params:", {
    oauth_consumer_key: `${oauthParams.oauth_consumer_key.substring(0, 5)}...`,
    oauth_token: `${oauthParams.oauth_token.substring(0, 5)}...`,
    oauth_nonce: oauthParams.oauth_nonce,
    oauth_timestamp: oauthParams.oauth_timestamp,
  });

  const signature = generateOAuthSignature(method, url, oauthParams, API_SECRET!, ACCESS_TOKEN_SECRET!);

  const signedOAuthParams = {
    ...oauthParams,
    oauth_signature: signature,
  };

  const entries = Object.entries(signedOAuthParams).sort((a, b) => a[0].localeCompare(b[0]));
  const header = "OAuth " + entries.map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`).join(", ");
  
  console.log(`✅ OAuth header generated (length: ${header.length})`);
  
  return header;
}

async function uploadMedia(imageData: string): Promise<string> {
  const url = "https://upload.twitter.com/1.1/media/upload.json";
  const method = "POST";

  // Convert base64 to binary
  const base64Data = imageData.split(',')[1];
  const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

  const formData = new FormData();
  formData.append('media', new Blob([binaryData]));

  const oauthHeader = generateOAuthHeader(method, url);

  const response = await fetch(url, {
    method: method,
    headers: { 
      Authorization: oauthHeader
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
  const method = "POST";
  
  const params: any = { text };
  if (mediaIds && mediaIds.length > 0) {
    params.media = { media_ids: mediaIds };
  }
  if (replyToId) {
    params.reply = { in_reply_to_tweet_id: replyToId };
  }

  console.log("📤 Sending tweet:", { textLength: text.length, hasMedia: !!mediaIds, isReply: !!replyToId });

  const oauthHeader = generateOAuthHeader(method, url);

  const response = await fetch(url, {
    method: method,
    headers: {
      Authorization: oauthHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  const responseText = await response.text();
  console.log(`📨 Twitter API Response (${response.status}):`, responseText);

  if (!response.ok) {
    console.error("❌ Tweet failed:", { status: response.status, body: responseText });
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
