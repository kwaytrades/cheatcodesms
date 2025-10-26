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

// Agent-specific response guidelines - CHARACTER LIMITS ONLY
const RESPONSE_GUIDELINES: Record<string, string> = {
  'textbook': `
CHARACTER LIMIT: Your response MUST be between 160-480 characters.
- For complex topics, provide focused key points only
- Example: "Chapter 3 covers risk management fundamentals: position sizing (how much to risk per trade), stop-loss placement (where to exit losing trades), and portfolio diversification (spreading risk across assets). These principles protect your capital while trading." (282 chars)`,
  
  'customer_service': `
CHARACTER LIMIT: Your response MUST be between 160-480 characters.
- Direct, helpful answers only
- Example: "I can help with that! Your account issue is likely related to payment processing. I've escalated this to our billing team and they'll reach out within 24 hours. Is there anything else I can help with?" (225 chars)`,
  
  'flashcards': `
CHARACTER LIMIT: Your response MUST be between 160-480 characters.
- Brief definitions with one example
- Example: "A stop-loss is an order that automatically exits a trade when price hits a predetermined level. It limits your loss on a position. Example: If you buy stock at $100 with a stop at $95, you'll exit if it drops 5%." (226 chars)`,
  
  'sales_agent': `
CHARACTER LIMIT: Your response MUST be between 160-480 characters.
- Answer directly, then add one benefit or CTA
- Example: "The Algo V5 gives you precise entry/exit signals synced to TradingView. It's saved our users an average of 2+ hours daily on chart analysis. Want to see how it works with your trading style?" (199 chars)`,
  
  'trade_analysis': `
CHARACTER LIMIT: Your response MUST be between 160-480 characters.
- Focus on 2-3 key technical points
- Example: "AAPL is showing bullish divergence on the RSI while price makes lower lows. Volume is decreasing on the downmove, suggesting weakening selling pressure. A break above $175 with volume confirmation could signal reversal." (229 chars)`,
  
  'webinar': `
CHARACTER LIMIT: Your response MUST be between 160-480 characters.
- Create excitement briefly
- Example: "This Thursday at 8pm EST! We're covering advanced options strategies including iron condors and credit spreads. Chris will show live trade setups and answer questions. Spots are limited - want me to save you a seat?" (223 chars)`,
  
  'algo_monthly': `
CHARACTER LIMIT: Your response MUST be between 160-480 characters.
- Focus on one specific technical aspect
- Example: "The 4/4 sync requires both your timeframes and indicators to align with TradingView. Go to Settings > Sync Configuration and verify your primary timeframe is set to match your chart. Need help with a specific setup?" (223 chars)`,
  
  'ccta': `
CHARACTER LIMIT: Your response MUST be between 160-480 characters.
- Advanced concepts condensed to essentials
- Example: "Module 3 covers multi-timeframe confluence analysis. You'll learn to align daily support/resistance with 4H momentum and 15M entry timing. This reduces false signals by 40-60%. Ready to dive into the first lesson?" (220 chars)`,
  
  'lead_nurture': `
CHARACTER LIMIT: Your response MUST be between 160-480 characters.
- Build rapport briefly
- Example: "That's a great question about risk management! Many traders struggle with position sizing at first. I have a free guide that breaks down the formula step-by-step. Would that be helpful?" (190 chars)`
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
        .select(`
          full_name, email, customer_tier, products_owned, products_interested,
          total_spent, lead_score, lead_status, sentiment, personality_type,
          trading_experience, trading_style, account_size, risk_tolerance,
          goals, objections, behavioral_tags, last_engagement_action,
          ai_profile, customer_profile, webinar_attendance, form_responses
        `)
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

    // Build detailed customer context
    let customerContext = `CUSTOMER PROFILE:
Name: ${customerName}
Tier: ${customerTier} | Spent: $${contact?.total_spent || 0} | Lead Score: ${contact?.lead_score || 'N/A'}`;

    // Trading profile
    if (contact?.trading_experience || contact?.trading_style || contact?.account_size) {
      customerContext += `\n\nTRADING PROFILE:`;
      if (contact.trading_experience) customerContext += `\nExperience: ${contact.trading_experience}`;
      if (contact.trading_style) customerContext += `\nStyle: ${contact.trading_style}`;
      if (contact.account_size) customerContext += `\nAccount Size: ${contact.account_size}`;
      if (contact.risk_tolerance) customerContext += `\nRisk Tolerance: ${contact.risk_tolerance}`;
    }

    // Products & interests
    if (productsOwned.length > 0) {
      customerContext += `\n\nOWNS: ${productsOwned.join(', ')}`;
    }
    if (contact?.products_interested && contact.products_interested.length > 0) {
      customerContext += `\nINTERESTED IN: ${contact.products_interested.join(', ')}`;
    }

    // Goals & objections
    if (contact?.goals && contact.goals.length > 0) {
      customerContext += `\n\nGOALS: ${contact.goals.join(', ')}`;
    }
    if (contact?.objections) {
      customerContext += `\nOBJECTIONS: ${contact.objections}`;
    }

    // Behavioral insights
    if (contact?.personality_type) {
      customerContext += `\n\nPERSONALITY: ${contact.personality_type}`;
    }
    if (contact?.behavioral_tags && contact.behavioral_tags.length > 0) {
      customerContext += `\nBEHAVIORS: ${contact.behavioral_tags.join(', ')}`;
    }
    if (contact?.sentiment) {
      customerContext += `\nSENTIMENT: ${contact.sentiment}`;
    }

    // AI-generated profile
    if (contact?.ai_profile && typeof contact.ai_profile === 'object') {
      const profile = contact.ai_profile as any;
      if (profile.summary) {
        customerContext += `\n\nAI SUMMARY: ${profile.summary}`;
      }
      if (profile.communication_style) {
        customerContext += `\nCommunication Style: ${profile.communication_style}`;
      }
    }

    // Recent engagement
    if (contact?.last_engagement_action) {
      customerContext += `\n\nLAST ACTION: ${contact.last_engagement_action}`;
    }

    // Lead status
    if (contact?.lead_status) {
      customerContext += `\nSTATUS: ${contact.lead_status}`;
    }

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

    // Get agent-specific response guidelines
    const responseGuidelines = RESPONSE_GUIDELINES[agentType] || `
RESPONSE GUIDELINES:
- Keep responses focused and relevant
- Reference past context naturally when relevant
- Match the customer's communication style`;

    // Construct system message
    const systemMessage = `${systemPrompt}

Tone: ${tone}

${customerContext}${memoryContext}${kbContext}

${responseGuidelines}`;

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
        max_tokens: 150,
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

    // Validate character count (don't truncate, just log)
    const charCount = aiMessage.length;
    if (charCount < 160) {
      console.warn(`⚠️ Response too short for ${agentType}: ${charCount} chars`);
    } else if (charCount > 480) {
      console.warn(`⚠️ Response too long for ${agentType}: ${charCount} chars (exceeded by ${charCount - 480})`);
    } else {
      console.log(`✅ Response length OK for ${agentType}: ${charCount} chars`);
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
