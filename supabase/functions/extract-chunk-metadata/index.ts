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
  category?: string;
  documentType?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, pageNumber, previousChapterContext, category, documentType }: MetadataRequest = await req.json();
    
    // Early exit for non-textbook documents - return basic metadata
    if (documentType !== 'textbook') {
      return new Response(JSON.stringify({
        chunk_index: null,
        content_type: documentType || 'general',
        document_type: documentType,
        topics: [],
        keywords: [],
        summary: text.substring(0, 100) + '...',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
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
7. DETECT quiz/test sections and extract questions WITH answers
8. Topics should be specific trading/finance concepts found in the text
9. Content type should be: instructional, definition, example, exercise, summary, quiz, or reference
10. Complexity: beginner (basic concepts), intermediate (requires prior knowledge), or advanced (expert level)

QUIZ DETECTION:
- Look for patterns like "Chapter Review Questions", "Practice Quiz", "Test Your Knowledge"
- Identify numbered questions with options (1. A) B) C) D))
- Capture True/False questions
- Capture fill-in-the-blank questions
- Include answer keys if present (often marked "Answers: 1.B 2.A 3.D")

${previousChapterContext ? `CONTEXT: Previous chunk was in Chapter ${previousChapterContext.chapter_number}: "${previousChapterContext.chapter_title}"` : ''}`;

    const userPrompt = `Extract metadata from this textbook chunk (page ${pageNumber || 'unknown'}):

${text.substring(0, 2000)}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
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
                  enum: ['instructional', 'definition', 'example', 'exercise', 'summary', 'quiz', 'reference'],
                  description: 'Type of content in this chunk'
                },
                is_quiz_question: {
                  type: 'boolean',
                  description: 'True if this chunk contains quiz/test questions'
                },
                quiz_questions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      question_number: { type: 'integer' },
                      question_text: { type: 'string' },
                      question_type: { 
                        type: 'string',
                        enum: ['multiple_choice', 'true_false', 'short_answer', 'matching', 'fill_blank']
                      },
                      options: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Answer options (e.g., ["A) Bulls", "B) Bears", "C) Traders"])'
                      },
                      correct_answer: {
                        type: 'string',
                        description: 'The correct answer if visible in text (e.g., "B" or "False")'
                      }
                    },
                    required: ['question_number', 'question_text', 'question_type']
                  },
                  description: 'Array of quiz questions found in this chunk with their answers'
                },
                quiz_type: {
                  type: ['string', 'null'],
                  enum: ['chapter_review', 'practice_quiz', 'midterm', 'final_exam', 'self_assessment', null],
                  description: 'Type of quiz if this is a quiz section'
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
      console.error('OpenAI error:', response.status, errorText);
      throw new Error(`AI request failed: ${response.status} - ${errorText}`);
    }

    const aiResponse = await response.json();
    console.log('AI response received:', JSON.stringify(aiResponse, null, 2));

    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      console.error('No tool call in AI response. Full response:', JSON.stringify(aiResponse, null, 2));
      throw new Error('No tool call in AI response');
    }

    console.log('Tool call arguments:', toolCall.function.arguments);
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
