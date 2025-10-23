import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChunkRequest {
  document_id: string;
  content: string;
  title: string;
  category: string;
}

// Simple chunking function: 1000 tokens (~750 words) with 200 token overlap
function chunkText(text: string, chunkSize = 1000, overlap = 200): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let wordCount = 0;

  for (const word of words) {
    currentChunk.push(word);
    wordCount++;

    if (wordCount >= chunkSize) {
      chunks.push(currentChunk.join(' '));
      // Keep overlap words for context
      currentChunk = currentChunk.slice(-overlap);
      wordCount = overlap;
    }
  }

  // Add remaining words as final chunk
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(' '));
  }

  return chunks;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { document_id, content, title, category }: ChunkRequest = await req.json();

    console.log(`Chunking document: ${title} (${content.length} chars)`);

    // Chunk the content
    const chunks = chunkText(content);
    console.log(`Created ${chunks.length} chunks`);

    // Generate embeddings using Lovable AI
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Store each chunk with its embedding
    const chunkRecords = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      // Generate embedding for this chunk
      const embeddingResponse = await fetch('https://ai.gateway.lovable.dev/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: chunk,
        }),
      });

      if (!embeddingResponse.ok) {
        console.error('Embedding generation failed:', await embeddingResponse.text());
        continue;
      }

      const embeddingData = await embeddingResponse.json();
      const embedding = embeddingData.data[0].embedding;

      // Extract page number from chunk if available
      const pageMatch = chunk.match(/Page (\d+)/);
      const pageNumber = pageMatch ? parseInt(pageMatch[1]) : null;

      chunkRecords.push({
        title: `${title} - Chunk ${i + 1}`,
        content: chunk,
        category,
        embedding,
        parent_document_id: document_id,
        chunk_index: i,
        chunk_metadata: {
          page_number: pageNumber,
          total_chunks: chunks.length,
          char_count: chunk.length,
        },
      });
    }

    // Insert all chunks
    const { data: insertedChunks, error: insertError } = await supabase
      .from('knowledge_base')
      .insert(chunkRecords)
      .select();

    if (insertError) throw insertError;

    console.log(`Successfully stored ${insertedChunks?.length || 0} chunks`);

    return new Response(
      JSON.stringify({
        success: true,
        chunks_created: insertedChunks?.length || 0,
        chunk_ids: insertedChunks?.map(c => c.id),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in chunk-and-embed-pdf:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
