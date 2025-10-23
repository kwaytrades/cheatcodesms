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

    const { query, category } = await req.json();

    console.log('Searching knowledge base:', { query, category });

    let results;

    // Try vector search first if we have a query
    if (query) {
      try {
        // Generate embedding for the search query using Lovable AI
        const embeddingResponse = await fetch('https://ai.gateway.lovable.dev/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: query,
          }),
        });

        if (embeddingResponse.ok) {
          const embeddingData = await embeddingResponse.json();
          const queryEmbedding = embeddingData.data[0].embedding;

          console.log('Using vector search');

          // Use vector similarity search - return chunks
          const { data: vectorResults, error: vectorError } = await supabase.rpc('match_documents', {
            query_embedding: queryEmbedding,
            match_threshold: 0.7,
            match_count: 5
          });

          if (!vectorError && vectorResults && vectorResults.length > 0) {
            // Enrich with context chunks
            const enriched = [];
            for (const result of vectorResults) {
              const chunk: any = { ...result };
              
              // Get adjacent chunks if this is part of a chunked document
              if (result.parent_document_id) {
                const { data: siblings } = await supabase
                  .from('knowledge_base')
                  .select('content, chunk_index')
                  .eq('parent_document_id', result.parent_document_id)
                  .in('chunk_index', [result.chunk_index - 1, result.chunk_index + 1])
                  .order('chunk_index');
                
                if (siblings && siblings.length > 0) {
                  chunk.context_chunks = siblings;
                }
              }
              enriched.push(chunk);
            }
            
            results = enriched;
            console.log('Vector search found', results.length, 'chunks');
          }
        }
      } catch (vectorError) {
        console.log('Vector search failed, falling back to keyword search:', vectorError);
      }
    }

    // Fallback to keyword search if vector search didn't work or no results
    if (!results || results.length === 0) {
      console.log('Using keyword search fallback');
      
      let searchQuery = supabase
        .from('knowledge_base')
        .select('*');

      // Filter by category if provided
      if (category) {
        searchQuery = searchQuery.eq('category', category);
      }

      // Improved text search - split query into keywords and search for each
      if (query) {
        const keywords = query
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, ' ')
          .split(/\s+/)
          .filter((word: string) => word.length > 2 && !['the', 'and', 'for', 'what', 'about'].includes(word));
        
        console.log('Search keywords:', keywords);
        
        if (keywords.length > 0) {
          const conditions = keywords
            .map((keyword: string) => `title.ilike.%${keyword}%,content.ilike.%${keyword}%`)
            .join(',');
          searchQuery = searchQuery.or(conditions);
        }
      }

      const { data: keywordResults, error } = await searchQuery.limit(15);

      if (error) {
        console.error('Knowledge base search error:', error);
        throw error;
      }

      results = keywordResults;
      console.log('Keyword search found', results?.length || 0, 'documents');
    }

    // Return FULL content with chunk metadata
    const formattedResults = results?.map((doc: any) => ({
      title: doc.title,
      category: doc.category,
      content: doc.content,
      similarity: doc.similarity || undefined,
      chunk_metadata: doc.chunk_metadata,
      context_chunks: doc.context_chunks,
    })) || [];

    return new Response(
      JSON.stringify({ results: formattedResults }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Search knowledge base error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        results: []
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
