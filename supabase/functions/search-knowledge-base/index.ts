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
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { query, category } = await req.json();

    console.log('Searching knowledge base with full-text search:', { query, category });

    let results;

    // Use full-text search with keyword matching
    if (query) {
      console.log('Using full-text search');
      
      let searchQuery = supabase
        .from('knowledge_base')
        .select('*')
        .not('parent_document_id', 'is', null); // Only search chunks, not parent docs

      // Filter by category if provided
      if (category) {
        searchQuery = searchQuery.eq('category', category);
      }

      // Full-text search with keyword matching
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

      const { data: searchResults, error } = await searchQuery.limit(10);

      if (error) {
        console.error('Knowledge base search error:', error);
        throw error;
      }

      // Enrich with context chunks
      const enriched = [];
      for (const result of searchResults || []) {
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
      console.log('Full-text search found', results?.length || 0, 'chunks');
    } else {
      results = [];
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
