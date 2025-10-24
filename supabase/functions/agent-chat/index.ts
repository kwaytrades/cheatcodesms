import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// Map agent types to their knowledge base categories
const KB_CATEGORY_MAP: Record<string, string> = {
  'textbook': 'agent_textbook',
  'customer_service': 'agent_customer_service',
  'sales_agent': 'sales',
  'trade_analysis': 'trading',
  'webinar': 'agent_webinar',
  'flashcards': 'agent_flashcards',
  'algo_monthly': 'agent_algo_monthly',
  'ccta': 'agent_ccta',
  'lead_nurture': 'agent_lead_nurture'
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { contactId, agentType = 'customer_service', message, conversationId } = await req.json();

    if (!contactId || !message) {
      throw new Error('contactId and message are required');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Get or create agent conversation
    let { data: conversation, error: convError } = await supabase
      .from('agent_conversations')
      .select('*')
      .eq('contact_id', contactId)
      .eq('agent_type', agentType)
      .maybeSingle();

    if (convError) throw convError;

    if (!conversation) {
      const { data: newConv, error: createError } = await supabase
        .from('agent_conversations')
        .insert({
          contact_id: contactId,
          agent_type: agentType,
          status: 'active',
        })
        .select()
        .single();

      if (createError) throw createError;
      conversation = newConv;
    }

    // 2. Fetch agent configuration
    const { data: agentConfig, error: configError } = await supabase
      .from('agent_type_configs')
      .select('*')
      .eq('agent_type', agentType)
      .maybeSingle();

    if (configError) throw configError;

    const systemPrompt = agentConfig?.system_prompt || 'You are a helpful customer service assistant.';
    const tone = agentConfig?.tone || 'professional';

    // 3. Build context - Parallel queries
    const [
      { data: recentMessages },
      { data: contact }
    ] = await Promise.all([
      // A. Recent messages (last 10)
      supabase
        .from('agent_messages')
        .select('role, content, created_at')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: false })
        .limit(10),
      
      // B. Customer profile
      supabase
        .from('contacts')
        .select('full_name, email, customer_tier, products_owned, total_spent, lead_score')
        .eq('id', contactId)
        .single()
    ]);

    // C. Knowledge base search (with error handling)
    let kbResults: any = null;
    try {
      // Map agent type to knowledge base category
      const kbCategory = KB_CATEGORY_MAP[agentType] || agentType;
      
      const kbResponse = await supabase.functions.invoke('search-knowledge-base', {
        body: { 
          query: message,
          category: kbCategory,
          matchCount: 3 
        }
      });
      kbResults = kbResponse.data;
    } catch (kbError) {
      console.error('Knowledge base search failed (non-fatal):', kbError);
      // Continue without KB context
    }

    // 4. Generate embedding for semantic memory search
    const { data: embeddingData, error: embError } = await supabase.functions.invoke(
      'generate-embedding',
      { body: { text: message } }
    );

    let semanticMemories: any[] = [];
    if (embeddingData?.embedding) {
      // Search for semantically similar past messages
      const { data: memories, error: memError } = await supabase.rpc(
        'search_agent_memories',
        {
          p_conversation_id: conversation.id,
          query_embedding: embeddingData.embedding,
          match_threshold: 0.7,
          match_count: 3
        }
      );

      if (!memError && memories) {
        semanticMemories = memories;
      }
    }

    // 5. Construct LLM prompt
    const customerName = contact?.full_name || 'Customer';
    const customerTier = contact?.customer_tier || 'Standard';
    const productsOwned = contact?.products_owned || [];

    const customerContext = `Customer: ${customerName} (${customerTier} tier, ${productsOwned.length} products, $${contact?.total_spent || 0} spent)`;

    // Build conversation history (chronological order)
    const conversationHistory: any[] = [];
    
    // Add recent messages (reversed to chronological)
    if (recentMessages && recentMessages.length > 0) {
      recentMessages.reverse().forEach((msg: any) => {
        conversationHistory.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        });
      });
    }

    // Add semantic memories as context (if different from recent)
    let memoryContext = '';
    if (semanticMemories.length > 0) {
      memoryContext = '\n\nRELEVANT PAST CONVERSATION:\n' + 
        semanticMemories.map((m: any) => 
          `${m.role === 'user' ? 'Customer' : 'You'}: ${m.content}`
        ).join('\n');
    }

    // Add knowledge base context
    let kbContext = '';
    if (kbResults?.results && kbResults.results.length > 0) {
      kbContext = '\n\nRELEVANT KNOWLEDGE:\n' + 
        kbResults.results.map((kb: any) => kb.content).join('\n\n');
    }

    // Construct system message
    const systemMessage = `${systemPrompt}

Tone: ${tone}

${customerContext}${memoryContext}${kbContext}

RESPONSE GUIDELINES:
- Keep responses concise (2-4 sentences for simple questions)
- Reference past context naturally when relevant
- Don't repeat information already discussed
- Match the customer's communication style`;

    // Build messages for LLM
    const llmMessages = [
      { role: 'system', content: systemMessage },
      ...conversationHistory,
      { role: 'user', content: message }
    ];

    // 6. Call Lovable AI Gateway
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('Lovable API key not configured');
    }

    const llmResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: llmMessages,
        max_tokens: 250,
        temperature: 0.7,
      }),
    });

    // Handle rate limit and payment errors
    if (!llmResponse.ok) {
      if (llmResponse.status === 429) {
        return new Response(
          JSON.stringify({ 
            error: "Rate limit exceeded. Please try again in a moment.",
            needsHumanIntervention: false
          }),
          { 
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
      if (llmResponse.status === 402) {
        return new Response(
          JSON.stringify({ 
            error: "AI service requires payment. Please contact support.",
            needsHumanIntervention: true
          }),
          { 
            status: 402,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
      
      const error = await llmResponse.text();
      console.error('LLM API error:', error);
      throw new Error(`LLM API error: ${llmResponse.status}`);
    }

    const llmData = await llmResponse.json();
    let aiMessage = llmData.choices[0].message.content;

    // 7. Post-process response
    aiMessage = aiMessage
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/#{1,6}\s/g, '')
      .replace(/You've asked about:?/gi, '')
      .replace(/Let me help you with that\.?/gi, '')
      .trim();

    // Truncate if too verbose for simple questions
    const questionWordCount = message.split(/\s+/).length;
    const responseWordCount = aiMessage.split(/\s+/).length;

    if (questionWordCount < 10 && responseWordCount > 60) {
      const sentences = aiMessage.split(/[.!?]+/).filter((s: string) => s.trim().length > 0);
      aiMessage = sentences.slice(0, 2).join('. ').trim() + '.';
    }

    const latency = Date.now() - startTime;

    // 8. Generate embedding for user message
    const userEmbedding = embeddingData?.embedding || null;

    // 9. Save messages to database
    const messagesToInsert = [
      {
        conversation_id: conversation.id,
        role: 'user',
        content: message,
        token_count: message.split(/\s+/).length,
        embedding: userEmbedding,
        customer_context: { tier: customerTier, products: productsOwned },
      },
      {
        conversation_id: conversation.id,
        role: 'assistant',
        content: aiMessage,
        token_count: aiMessage.split(/\s+/).length,
        model_used: 'google/gemini-2.5-flash',
        latency_ms: latency,
        knowledge_chunks_used: kbResults?.results?.map((r: any) => r.id) || [],
      }
    ];

    const { error: insertError } = await supabase
      .from('agent_messages')
      .insert(messagesToInsert);

    if (insertError) {
      console.error('Error saving messages:', insertError);
    }

    // Generate embedding for AI response asynchronously (don't await)
    if (aiMessage) {
      supabase.functions.invoke('generate-embedding', {
        body: { text: aiMessage }
      }).then(async ({ data: aiEmbedding }) => {
        if (aiEmbedding?.embedding) {
          await supabase
            .from('agent_messages')
            .update({ embedding: aiEmbedding.embedding })
            .eq('conversation_id', conversation.id)
            .eq('role', 'assistant')
            .eq('content', aiMessage);
        }
      }).catch(embeddingError => {
        console.error('Failed to generate response embedding (non-fatal):', embeddingError);
        // Message saved, embedding failed (non-fatal)
      });
    }

    // 10. Update conversation metadata (handled by trigger)

    // 11. Return response
    return new Response(
      JSON.stringify({
        response: aiMessage,
        conversationId: conversation.id,
        latency,
        needsHuman: aiMessage.toLowerCase().includes('specialist') || 
                    aiMessage.toLowerCase().includes('connect you with'),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in agent-chat:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
