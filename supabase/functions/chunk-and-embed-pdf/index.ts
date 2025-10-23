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

// Smart chunking: ~2000 chars with 200 char overlap, split on paragraph/sentence boundaries
function chunkText(text: string, chunkSize = 2000, overlap = 200): string[] {
  const chunks: string[] = [];
  let startIndex = 0;
  
  while (startIndex < text.length) {
    let endIndex = Math.min(startIndex + chunkSize, text.length);
    
    // Try to end at a paragraph break (but not if we're at the end)
    if (endIndex < text.length) {
      const paragraphBreak = text.indexOf('\n\n', endIndex - 100);
      if (paragraphBreak !== -1 && paragraphBreak < endIndex + 100) {
        endIndex = paragraphBreak + 2;
      } else {
        // Try to end at a sentence
        const sentenceEnd = text.lastIndexOf('. ', endIndex);
        if (sentenceEnd !== -1 && sentenceEnd > startIndex + chunkSize - 200) {
          endIndex = sentenceEnd + 2;
        }
      }
    }
    
    const chunk = text.slice(startIndex, endIndex).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }
    
    startIndex = endIndex - overlap;
    if (startIndex >= text.length) break;
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
    
    // Validate content length
    if (!content || content.length < 100) {
      throw new Error(`Content too short to chunk (${content?.length || 0} chars). Minimum 100 characters required.`);
    }

    // Chunk the content
    const chunks = chunkText(content);
    console.log(`Created ${chunks.length} chunks`);

    // Store each chunk WITHOUT embeddings (full-text search will be used)
    const chunkRecords = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      // Extract page number from chunk if available
      const pageMatch = chunk.match(/Page (\d+)/);
      const pageNumber = pageMatch ? parseInt(pageMatch[1]) : null;

      chunkRecords.push({
        title: `${title} - Chunk ${i + 1}`,
        content: chunk,
        category,
        embedding: null, // No embeddings - using full-text search
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
