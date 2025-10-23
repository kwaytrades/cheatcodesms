import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { documentId, content, enhancedInput, documentType } = await req.json();

    console.log('Generating embedding for document:', documentId, 'Type:', documentType);

    // Use enhanced input if provided (for textbooks), otherwise use raw content
    const inputText = enhancedInput || content;

    console.log('Input text length:', inputText.length, 'chars');

    // Generate embedding using Lovable AI
    const embeddingResponse = await fetch('https://ai.gateway.lovable.dev/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: inputText.substring(0, 8000), // Limit to 8k chars for embedding model
      }),
    });

    if (!embeddingResponse.ok) {
      const error = await embeddingResponse.text();
      console.error('Embedding generation error:', error);
      throw new Error(`Failed to generate embedding: ${error}`);
    }

    const embeddingData = await embeddingResponse.json();
    const embedding = embeddingData.data[0].embedding;

    console.log('Embedding generated, updating database');

    // Get existing metadata
    const { data: existingDoc } = await supabase
      .from('knowledge_base')
      .select('chunk_metadata')
      .eq('id', documentId)
      .single();

    const existingMetadata = existingDoc?.chunk_metadata || {};

    // Update the knowledge_base record with the embedding
    const { error: updateError } = await supabase
      .from('knowledge_base')
      .update({ 
        embedding,
        chunk_metadata: {
          ...existingMetadata,
          embedding_input_preview: inputText.substring(0, 500),
          embedding_enhanced: !!enhancedInput
        }
      })
      .eq('id', documentId);

    if (updateError) {
      console.error('Database update error:', updateError);
      throw updateError;
    }

    return new Response(
      JSON.stringify({ success: true, documentId }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Generate embeddings error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
