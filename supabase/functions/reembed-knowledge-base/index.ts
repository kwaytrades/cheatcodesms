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

    const { category, documentType = 'textbook' } = await req.json();

    console.log('Re-embedding documents for category:', category);

    // Fetch all chunks for this category that need embeddings
    const { data: chunks, error: fetchError } = await supabase
      .from('knowledge_base')
      .select('*')
      .eq('category', category)
      .not('parent_document_id', 'is', null)  // Only chunks
      .order('created_at', { ascending: true });

    if (fetchError) throw fetchError;

    console.log(`Found ${chunks.length} chunks to re-embed`);

    let processed = 0;
    let enhanced = 0;

    for (const chunk of chunks) {
      try {
        const metadata = chunk.chunk_metadata || {};
        
        // Build enhanced input for textbooks
        let enhancedInput = null;
        if (documentType === 'textbook') {
          const parts: string[] = [];
          
          if (metadata.chapter_number && metadata.chapter_title) {
            parts.push(`Chapter ${metadata.chapter_number}: ${metadata.chapter_title}`);
          }
          
          if (metadata.section_title) {
            parts.push(`Section: ${metadata.section_title}`);
          }
          
          if (metadata.topics && metadata.topics.length > 0) {
            parts.push(`Topics: ${metadata.topics.join(', ')}`);
          }
          
          if (metadata.keywords && metadata.keywords.length > 0) {
            parts.push(`Key Terms: ${metadata.keywords.join(', ')}`);
          }
          
          if (metadata.summary) {
            parts.push(`Summary: ${metadata.summary}`);
          }
          
          parts.push('\n--- Content ---\n');
          parts.push(chunk.content);
          
          if (metadata.answers_questions && metadata.answers_questions.length > 0) {
            parts.push('\n--- Can Answer ---');
            parts.push(metadata.answers_questions.join('\n'));
          }
          
          enhancedInput = parts.join('\n');
          enhanced++;
        }

        const inputText = enhancedInput || chunk.content;

        // Generate embedding
        const embeddingResponse = await fetch('https://ai.gateway.lovable.dev/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: inputText.substring(0, 8000),
          }),
        });

        if (!embeddingResponse.ok) {
          console.error(`Failed to generate embedding for chunk ${chunk.id}`);
          continue;
        }

        const embeddingData = await embeddingResponse.json();
        const embedding = embeddingData.data[0].embedding;

        // Update chunk with embedding
        await supabase
          .from('knowledge_base')
          .update({
            embedding,
            chunk_metadata: {
              ...metadata,
              embedding_enhanced: !!enhancedInput,
              reembedded_at: new Date().toISOString()
            }
          })
          .eq('id', chunk.id);

        processed++;
        console.log(`Processed ${processed}/${chunks.length}`);

      } catch (chunkError) {
        console.error(`Error processing chunk ${chunk.id}:`, chunkError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed,
        enhanced,
        total: chunks.length
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Re-embedding error:', error);
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
