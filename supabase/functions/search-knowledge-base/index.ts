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

    // Use enhanced search with metadata support
    if (query) {
      console.log('Using enhanced metadata search');
      
      let searchQuery = supabase
        .from('knowledge_base')
        .select('*')
        .not('parent_document_id', 'is', null); // Only search chunks, not parent docs

      // Filter by category if provided
      if (category) {
        searchQuery = searchQuery.eq('category', category);
      }

      // Extract keywords from query
      const keywords = query
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((word: string) => word.length > 2 && !['the', 'and', 'for', 'what', 'about'].includes(word));
      
      console.log('Search keywords:', keywords);
      
      // Detect chapter number in query
      const chapterMatch = query.match(/chapter\s+(\d+)/i);
      const chapterNumber = chapterMatch ? chapterMatch[1] : null;
      
      if (chapterNumber) {
        console.log(`Detected chapter number: ${chapterNumber}`);
        // Search for chapter number in metadata
        searchQuery = searchQuery.eq('chunk_metadata->>chapter_number', chapterNumber);
      } else if (keywords.length > 0) {
        // Build search conditions across multiple fields
        const contentConditions = keywords
          .map((keyword: string) => `title.ilike.%${keyword}%,content.ilike.%${keyword}%`)
          .join(',');
        
        searchQuery = searchQuery.or(contentConditions);
      }

      const { data: searchResults, error } = await searchQuery.limit(15);

      if (error) {
        console.error('Knowledge base search error:', error);
        throw error;
      }

      // Score and rank results with robust JSONB metadata handling
      const scoredResults = (searchResults || []).map((doc: any) => {
        let score = 0;
        
        // Safely extract metadata - handle JSONB strings and objects
        let metadata = doc.chunk_metadata || {};
        if (typeof metadata === 'string') {
          try {
            metadata = JSON.parse(metadata);
          } catch (e) {
            console.error('Failed to parse chunk_metadata:', e);
            metadata = {};
          }
        }
        
        const lowerQuery = query.toLowerCase();
        let chapterNum = metadata.chapter_number;
        
        // Fallback: Try to extract chapter from title if missing
        if (!chapterNum && doc.title) {
          const titleMatch = doc.title.match(/Chapter (\d+)|Pages (\d+)-(\d+)/i);
          if (titleMatch) {
            chapterNum = titleMatch[1] ? parseInt(titleMatch[1]) : Math.floor(parseInt(titleMatch[2] || '0') / 50) + 1;
            console.log('Inferred chapter from title:', { title: doc.title, chapter: chapterNum });
          }
        }
        
        // Exact chapter match = highest priority
        if (chapterNumber && chapterNum === parseInt(chapterNumber)) {
          score += 100;
        }
        
        // Chapter title match = high priority
        if (metadata.chapter_title && metadata.chapter_title.toLowerCase().includes(lowerQuery)) {
          score += 80;
        }
        
        // Section title match = high priority
        if (metadata.section_title && metadata.section_title.toLowerCase().includes(lowerQuery)) {
          score += 60;
        }
        
        // Topic match = medium-high priority
        if (metadata.topics && Array.isArray(metadata.topics)) {
          const topicMatches = metadata.topics.filter((t: string) => 
            lowerQuery.includes(t.toLowerCase()) || t.toLowerCase().includes(lowerQuery)
          );
          score += topicMatches.length * 40;
        }
        
        // Keyword match = medium priority
        if (metadata.keywords && Array.isArray(metadata.keywords)) {
          const keywordMatches = metadata.keywords.filter((k: string) => 
            lowerQuery.includes(k.toLowerCase())
          );
          score += keywordMatches.length * 20;
        }
        
        // Content match = baseline priority
        if (doc.content.toLowerCase().includes(lowerQuery)) {
          score += 10;
        }
        
        return { 
          ...doc, 
          relevance_score: score,
          chapter_number: chapterNum,
          chapter_title: metadata.chapter_title,
          section_title: metadata.section_title,
          topics: metadata.topics || [],
          keywords: metadata.keywords || [],
          summary: metadata.summary
        };
      });
      
      // Sort by relevance score
      scoredResults.sort((a, b) => b.relevance_score - a.relevance_score);
      
      console.log('Top results:', scoredResults.slice(0, 3).map(r => ({
        title: r.title,
        score: r.relevance_score,
        chapter: r.chunk_metadata?.chapter_number,
        topics: r.chunk_metadata?.topics?.slice(0, 3)
      })));

      // Enrich with context chunks
      const enriched = [];
      for (const result of scoredResults) {
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

    // Return FULL content with enriched metadata
    const formattedResults = results?.map((doc: any) => ({
      title: doc.title,
      category: doc.category,
      content: doc.content,
      similarity: doc.similarity || undefined,
      relevance_score: doc.relevance_score || 0,
      chunk_metadata: doc.chunk_metadata,
      context_chunks: doc.context_chunks,
      // Use already-extracted metadata from scoring
      chapter_number: doc.chapter_number,
      chapter_title: doc.chapter_title,
      section_title: doc.section_title,
      topics: doc.topics || [],
      keywords: doc.keywords || [],
      summary: doc.summary,
      content_type: typeof doc.chunk_metadata === 'object' ? doc.chunk_metadata?.content_type : undefined,
      complexity: typeof doc.chunk_metadata === 'object' ? doc.chunk_metadata?.complexity : undefined,
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
