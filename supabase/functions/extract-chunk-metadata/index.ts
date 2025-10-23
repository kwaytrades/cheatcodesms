import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MetadataRequest {
  text: string;
  pageNumber?: number;
  previousChapterContext?: {
    chapter_number?: number;
    chapter_title?: string;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, pageNumber, previousChapterContext }: MetadataRequest = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log(`Extracting metadata for page ${pageNumber || 'unknown'}`);

    const systemPrompt = `You are a metadata extraction expert for educational textbooks. Extract structured metadata from the provided text chunk.

CRITICAL RULES:
1. Chapter titles should be descriptive (3-8 words typical)
2. Chapter numbers should be sequential (1-20 typical range)
3. REJECT quiz answers like "1. B 2. False" - these are NOT chapter titles
4. REJECT headers/footers (like "Page 42" or "Chapter 3 Summary")
5. REJECT table of contents entries
6. If no clear chapter marker exists, use previous chapter context if provided
7. Topics should be specific trading/finance concepts found in the text
8. Content type should be: instructional, definition, example, exercise, summary, or reference
9. Complexity: beginner (basic concepts), intermediate (requires prior knowledge), or advanced (expert level)

${previousChapterContext ? `CONTEXT: Previous chunk was in Chapter ${previousChapterContext.chapter_number}: "${previousChapterContext.chapter_title}"` : ''}`;

    const userPrompt = `Extract metadata from this textbook chunk (page ${pageNumber || 'unknown'}):

${text.substring(0, 2000)}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'extract_metadata',
            description: 'Extract structured metadata from textbook content',
            parameters: {
              type: 'object',
              properties: {
                chapter_number: {
                  type: ['integer', 'null'],
                  description: 'Chapter number (1-20 typical). Null if not found.'
                },
                chapter_title: {
                  type: ['string', 'null'],
                  description: 'Descriptive chapter title (3-8 words). Null if not found or if it looks like quiz answers.'
                },
                section_title: {
                  type: ['string', 'null'],
                  description: 'Section or subsection title within the chapter. Null if not found.'
                },
                topics: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'List of 3-7 specific trading/finance topics or concepts discussed'
                },
                keywords: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'List of 5-10 important keywords and terms'
                },
                content_type: {
                  type: 'string',
                  enum: ['instructional', 'definition', 'example', 'exercise', 'summary', 'reference'],
                  description: 'Type of content in this chunk'
                },
                complexity: {
                  type: 'string',
                  enum: ['beginner', 'intermediate', 'advanced'],
                  description: 'Complexity level of the content'
                },
                summary: {
                  type: 'string',
                  description: 'Brief 1-2 sentence summary of what this chunk covers'
                },
                answers_questions: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'List of 3-5 questions this content could answer'
                }
              },
              required: ['topics', 'keywords', 'content_type', 'complexity', 'summary', 'answers_questions'],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'extract_metadata' } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI error:', response.status, errorText);
      throw new Error(`AI request failed: ${response.status}`);
    }

    const aiResponse = await response.json();
    console.log('AI response received:', JSON.stringify(aiResponse).substring(0, 200));

    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error('No tool call in AI response');
    }

    const metadata = JSON.parse(toolCall.function.arguments);

    // Apply previous chapter context if no chapter info found
    if (!metadata.chapter_number && previousChapterContext?.chapter_number) {
      metadata.chapter_number = previousChapterContext.chapter_number;
      metadata.chapter_title = previousChapterContext.chapter_title;
    }

    // Validation: Reject suspicious chapter titles
    if (metadata.chapter_title) {
      const suspiciousPatterns = [
        /^\d+\.\s*[A-D]\s*\d+\./i,  // "1. B 2. False"
        /^page\s+\d+/i,              // "Page 42"
        /^(true|false|yes|no)$/i,    // Quiz answers
        /^\d+\s*$/,                  // Just numbers
      ];
      
      if (suspiciousPatterns.some(pattern => pattern.test(metadata.chapter_title))) {
        console.log(`Rejecting suspicious chapter title: "${metadata.chapter_title}"`);
        metadata.chapter_title = previousChapterContext?.chapter_title || null;
      }
    }

    console.log('Extracted metadata:', metadata);

    return new Response(JSON.stringify(metadata), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in extract-chunk-metadata:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      // Provide fallback basic metadata
      fallback: {
        chapter_number: null,
        chapter_title: null,
        topics: [],
        keywords: [],
        content_type: 'instructional',
        complexity: 'intermediate',
        summary: 'Content chunk from textbook',
        answers_questions: []
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
