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

    console.log('Searching knowledge base:', { query, category });

    // Build search query
    let searchQuery = supabase
      .from('knowledge_base')
      .select('*');

    // Filter by category if provided
    if (category) {
      searchQuery = searchQuery.eq('category', category);
    }

    // Improved text search - split query into keywords and search for each
    if (query) {
      // Extract keywords (remove common words, split by spaces)
      const keywords = query
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((word: string) => word.length > 2 && !['the', 'and', 'for', 'what', 'about'].includes(word));
      
      console.log('Search keywords:', keywords);
      
      if (keywords.length > 0) {
        // Build OR conditions for each keyword
        const conditions = keywords
          .map((keyword: string) => `title.ilike.%${keyword}%,content.ilike.%${keyword}%`)
          .join(',');
        searchQuery = searchQuery.or(conditions);
      }
    }

    const { data: results, error } = await searchQuery.limit(5);

    if (error) {
      console.error('Knowledge base search error:', error);
      throw error;
    }

    console.log('Found', results?.length || 0, 'relevant documents');

    // Format results for AI context
    const formattedResults = results?.map(doc => ({
      title: doc.title,
      category: doc.category,
      content: doc.content?.substring(0, 500), // Limit to 500 chars per doc
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
