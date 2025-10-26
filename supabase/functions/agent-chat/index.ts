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
    const { contactId, agentType = 'customer_service', message, conversationId: requestConversationId } = await req.json();

    if (!contactId || !message) {
      throw new Error('contactId and message are required');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if contact is in help mode FIRST
    const { data: helpModeData } = await supabase
      .from('conversation_state')
      .select('help_mode_until')
      .eq('contact_id', contactId)
      .maybeSingle();

    const isHelpMode = helpModeData?.help_mode_until && 
      new Date(helpModeData.help_mode_until) > new Date();

    // Override agentType if in help mode
    let effectiveAgentType = agentType;
    if (isHelpMode) {
      console.log('🚨 HELP MODE ACTIVE - Routing to customer_service');
      effectiveAgentType = 'customer_service';
    }

    // 1. Get or create agent conversation (using safe DB function)
    let conversationId: string;
    
    if (requestConversationId) {
      conversationId = requestConversationId;
    } else {
      // Use database function to safely get or create conversation (using effectiveAgentType)
      const { data: convId, error: convError } = await supabase
        .rpc('get_or_create_agent_conversation', {
          p_contact_id: contactId,
          p_agent_type: effectiveAgentType
        });

      if (convError) throw convError;
      conversationId = convId;
    }

    // 2. Fetch agent configuration (using effectiveAgentType)
    const { data: agentConfig, error: configError } = await supabase
      .from('agent_type_configs')
      .select('*')
      .eq('agent_type', effectiveAgentType)
      .maybeSingle();

    if (configError) throw configError;

    const systemPrompt = agentConfig?.system_prompt || 'You are a helpful customer service assistant.';
    const tone = agentConfig?.tone || 'professional';

    // 3. Build context - Fetch unified profile and recent messages in parallel
    console.log(`📊 Fetching unified customer profile for contact ${contactId}...`);
    const [
      { data: recentMessages },
      { data: customerProfileData, error: profileError }
    ] = await Promise.all([
      // A. Recent messages (last 10)
      supabase
        .from('agent_messages')
        .select('role, content, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(10),
      
      // B. Unified customer profile (cached for 5 minutes)
      supabase.rpc('get_customer_profile', { p_contact_id: contactId })
    ]);

    let customerProfile = customerProfileData;

    if (profileError || !customerProfile) {
      console.error('⚠️ Profile fetch failed, using direct query fallback:', profileError);
      
      const { data: contact } = await supabase
        .from('contacts')
        .select('full_name, customer_tier, total_spent, products_owned, email, phone_number, lead_score, engagement_score')
        .eq('id', contactId)
        .single();
      
      if (!contact) {
        throw new Error('Contact not found');
      }
      
      customerProfile = {
        identity: { 
          name: contact.full_name, 
          email: contact.email, 
          phone: contact.phone_number 
        },
        financial: {
          tier: contact.customer_tier || 'Lead',
          totalSpent: contact.total_spent || 0,
          productsOwned: contact.products_owned || [],
          productsCount: (contact.products_owned || []).length,
          hasDisputed: false,
          disputedAmount: 0
        },
        engagement: { 
          leadScore: contact.lead_score || 0, 
          engagementScore: contact.engagement_score || 0,
          likelihoodScore: 0,
          sentiment: null,
          lastEngagement: null
        },
        trading: {
          experience: null,
          style: null,
          accountSize: null,
          riskTolerance: null,
          interests: [],
          goals: [],
          sectors: []
        },
        behavioral: {
          personalityType: null,
          tags: [],
          regularTags: [],
          communicationStyle: 'Not analyzed',
          objections: null
        },
        insights: { 
          summary: '',
          lastUpdated: new Date().toISOString()
        }
      };
      
      console.log('✅ Built fallback profile:', customerProfile.financial);
    }

    console.log(`✅ Profile loaded: ${customerProfile.identity.name}`);
    console.log(`   Tier: ${customerProfile.financial.tier} | Products: ${customerProfile.financial.productsCount} | Spent: $${customerProfile.financial.totalSpent}`);

    // C. Knowledge base search (with error handling, using effectiveAgentType)
    let kbResults: any = null;
    try {
      // Map agent type to knowledge base category
      const kbCategory = KB_CATEGORY_MAP[effectiveAgentType] || effectiveAgentType;
      
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
          p_conversation_id: conversationId,
          query_embedding: embeddingData.embedding,
          match_threshold: 0.7,
          match_count: 3
        }
      );

      if (!memError && memories) {
        semanticMemories = memories;
      }
    }

    // 5. Construct LLM prompt from unified profile
    const productsOwned = customerProfile.financial.productsOwned || [];
    const hasProducts = productsOwned.length > 0;
    
    console.log(`🔍 Profile Context:`);
    console.log(`   - Name: ${customerProfile.identity.name}`);
    console.log(`   - Tier: ${customerProfile.financial.tier}`);
    console.log(`   - Products: ${productsOwned.length} (${productsOwned.join(', ') || 'None'})`);
    console.log(`   - Total Spent: $${customerProfile.financial.totalSpent}`);
    console.log(`   - Lead Score: ${customerProfile.engagement.leadScore}`);
    
    // Build detailed customer context from unified profile
    let customerContext = `CUSTOMER PROFILE:
Name: ${customerProfile.identity.name}
Email: ${customerProfile.identity.email || 'Not provided'}
Phone: ${customerProfile.identity.phone || 'Not provided'}

FINANCIAL STATUS:
Tier: ${customerProfile.financial.tier}
Total Spent: $${customerProfile.financial.totalSpent.toLocaleString()}
Products Owned: ${customerProfile.financial.productsCount}
${customerProfile.financial.hasDisputed ? `⚠️ DISPUTED: $${customerProfile.financial.disputedAmount}` : ''}

ENGAGEMENT METRICS:
Lead Score: ${customerProfile.engagement.leadScore}/100
Engagement Score: ${customerProfile.engagement.engagementScore}/100
Likelihood to Buy: ${customerProfile.engagement.likelihoodScore}/100
Sentiment: ${customerProfile.engagement.sentiment || 'Unknown'}

🔴 CRITICAL - PRODUCTS OWNED (${productsOwned.length}):
${hasProducts ? productsOwned.map((p: string) => `✓ ${p}`).join('\n') : '✗ NO PRODUCTS OWNED (This is a LEAD, not a customer)'}

${!hasProducts ? `
⚠️ CRITICAL: This contact has NOT purchased any products. They are a ${customerProfile.financial.tier}.
- DO NOT say they own products
- DO NOT mention "your purchase" or "the product you bought"  
- DO NOT offer product support
- FOCUS on nurturing and converting this lead
- Your role is to educate and build interest
` : `
✅ VERIFIED CUSTOMER: Owns ${productsOwned.length} product(s)
- You CAN provide support for their products
- You CAN reference their purchases
- Focus on helping them maximize value from owned products
- Consider upselling complementary products
`}

TRADING PROFILE:
Experience: ${customerProfile.trading.experience || 'Unknown'}
Trading Style: ${customerProfile.trading.style || 'Not specified'}
Account Size: ${customerProfile.trading.accountSize || 'Unknown'}
Risk Tolerance: ${customerProfile.trading.riskTolerance || 'Not assessed'}
Interests: ${customerProfile.trading.interests.join(', ') || 'None specified'}
Goals: ${customerProfile.trading.goals.join(', ') || 'None specified'}
Sectors: ${customerProfile.trading.sectors.join(', ') || 'None specified'}

BEHAVIORAL PROFILE:
Personality Type: ${customerProfile.behavioral.personalityType || 'Not analyzed'}
Communication Style: ${customerProfile.behavioral.communicationStyle}
Tags: ${customerProfile.behavioral.regularTags.join(', ') || 'None'}
Behavioral Tags: ${customerProfile.behavioral.tags.join(', ') || 'None'}
${customerProfile.behavioral.objections ? `Objections: ${customerProfile.behavioral.objections}` : ''}

AI INSIGHTS:
${customerProfile.insights.summary}`;

    // Log what context we're sending to the AI
    console.log('🔍 Customer Context for AI:', {
      contactId,
      agentType: effectiveAgentType,
      helpModeActive: isHelpMode,
      name: customerProfile.identity.name,
      tier: customerProfile.financial.tier,
      productsCount: productsOwned.length,
      productsOwned,
      contextLength: customerContext.length
    });

    // CRITICAL: Log if products exist but AI might miss them
    if (productsOwned.length > 0) {
      console.log('✅ PRODUCTS OWNED DETECTED:', productsOwned);
      console.log('⚠️ AI MUST acknowledge these products exist!');
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

    // Get agent-specific response guidelines (using effectiveAgentType)
    const responseGuidelines = RESPONSE_GUIDELINES[effectiveAgentType] || `
RESPONSE GUIDELINES:
- Keep responses focused and relevant
- Reference past context naturally when relevant
- Match the customer's communication style`;

    // Construct system message with STRONGER product context enforcement
    const systemMessage = `${systemPrompt}

---
🚨 CRITICAL INSTRUCTIONS - MANDATORY - READ FIRST:

1. YOU HAVE COMPLETE ACCESS TO ALL CUSTOMER DATA BELOW

2. 🛒 PRODUCTS OWNED (COUNT: ${productsOwned.length}):
   ${productsOwned.length > 0 ? productsOwned.map((p: string) => `   ✅ ${p}`).join('\n') : '   ⚠️ NONE - Customer has NOT purchased yet'}
   
   ${productsOwned.length === 0 
     ? '⚠️ Customer has NOT purchased yet - focus on value proposition.' 
     : `✅ Customer OWNS ${productsOwned.length} PRODUCT(S) - They are an ACTIVE CUSTOMER.`}

3. 💰 CUSTOMER TIER & SPENDING:
   - Total Spent: $${customerProfile.financial.totalSpent.toFixed(2)}
   - Customer Tier: ${customerProfile.financial.tier}
   
   🚨 CRITICAL TIER RULES:
   ${customerProfile.financial.tier === 'VIP' || customerProfile.financial.tier === 'Premium' 
     ? `   - This customer is ${customerProfile.financial.tier.toUpperCase()} tier with $${customerProfile.financial.totalSpent.toFixed(2)} spent
   - NEVER refer to them as a "LEAD" or suggest they haven't purchased
   - They are a VALUED CUSTOMER who deserves premium treatment`
     : customerProfile.financial.tier === 'Lead' && productsOwned.length > 0
     ? `   - ⚠️ DATA INCONSISTENCY: Tier shows "Lead" but customer owns ${productsOwned.length} product(s)
   - ALWAYS prioritize the PRODUCTS OWNED data over the tier label
   - Treat them as an ACTIVE CUSTOMER, not a lead`
     : '   - This is a prospective customer - focus on building value'}

4. NEVER CLAIM "I don't have access to your account/products/information"
5. ALL DATA IN "CUSTOMER CONTEXT" BELOW IS ACCESSIBLE TO YOU
6. REFERENCE ACTUAL DATA (name: ${customerProfile.identity.name}, tier: ${customerProfile.financial.tier}, products: ${productsOwned.join(', ') || 'none'})
---

Tone: ${tone}

${customerContext}${memoryContext}${kbContext}

${responseGuidelines}`;

    // Log what we're sending to the AI with DETAILED validation
    console.log('🔍 Context sent to AI:', {
      contactId,
      agentType: effectiveAgentType,
      helpModeActive: isHelpMode,
      productsOwned: customerProfile.financial.productsOwned || [],
      hasCustomerContext: customerContext.length > 0,
      systemPromptLength: systemMessage.length,
      contextPreview: customerContext.substring(0, 200)
    });

    // Validate that products are in the system message
    if (productsOwned.length > 0 && !systemMessage.includes(productsOwned[0])) {
      console.error('❌ CRITICAL: Products owned but NOT in system message!');
    }

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

    // 🚨 CRITICAL: Detect AI hallucinations about products/tier
    const lowerResponse = aiMessage.toLowerCase();
    const hasProductHallucination = productsOwned.length > 0 && (
      lowerResponse.includes("don't own any products") ||
      lowerResponse.includes("haven't purchased") ||
      lowerResponse.includes("no products") ||
      lowerResponse.includes("you don't have any")
    );
    
    const hasTierHallucination = (customerProfile.financial.tier === 'VIP' || customerProfile.financial.tier === 'Premium' || productsOwned.length > 0) && (
      lowerResponse.includes("lead tier") ||
      lowerResponse.includes("you're a lead") ||
      lowerResponse.includes("as a lead")
    );
    
    if (hasProductHallucination || hasTierHallucination) {
      console.error('🚨 AI HALLUCINATION DETECTED:');
      console.error(`   - Products owned: ${productsOwned.length} (${productsOwned.join(', ')})`);
      console.error(`   - Customer tier: ${customerProfile.financial.tier}`);
      console.error(`   - Total spent: $${customerProfile.financial.totalSpent}`);
      console.error(`   - AI response claimed: ${hasProductHallucination ? 'NO PRODUCTS' : 'LEAD TIER'}`);
      console.error(`   - Original response: ${aiMessage}`);
      
      // Override with factual correction
      if (hasProductHallucination) {
        aiMessage = `I can see you own ${productsOwned.length} product(s) with us: ${productsOwned.join(', ')}. How can I help you with these today?`;
      } else if (hasTierHallucination) {
        aiMessage = `As a valued ${customerProfile.financial.tier} customer who has invested $${customerProfile.financial.totalSpent.toFixed(2)} with us, you deserve excellent support. How can I assist you today?`;
      }
      
      console.log(`✅ Corrected response: ${aiMessage}`);
    }

    // Validate character count (don't truncate, just log)
    const charCount = aiMessage.length;
    if (charCount < 160) {
      console.warn(`⚠️ Response too short for ${effectiveAgentType}: ${charCount} chars`);
    } else if (charCount > 480) {
      console.warn(`⚠️ Response too long for ${effectiveAgentType}: ${charCount} chars (exceeded by ${charCount - 480})`);
    } else {
      console.log(`✅ Response length OK for ${effectiveAgentType}: ${charCount} chars`);
    }

    // CRITICAL: Validate response doesn't hallucinate missing products
    if (productsOwned.length > 0) {
      const hasDenialPhrases = 
        aiMessage.toLowerCase().includes("don't have access") ||
        aiMessage.toLowerCase().includes("cannot see") ||
        aiMessage.toLowerCase().includes("don't see any product") ||
        aiMessage.toLowerCase().includes("unable to access");

      if (hasDenialPhrases) {
        console.error('❌ AI HALLUCINATION DETECTED: Denying product access despite products_owned:', productsOwned);
        console.error('❌ Response:', aiMessage);
        // Override with correction
        aiMessage = `I can see you own: ${productsOwned.join(', ')}. How can I help you with these products?`;
        console.log('✅ CORRECTED response:', aiMessage);
      }
    }

    const latency = Date.now() - startTime;

    // 8. Generate embedding for user message
    const userEmbedding = embeddingData?.embedding || null;

    // 9. Save messages to database
    const messagesToInsert = [
      {
        conversation_id: conversationId,
        role: 'user',
        content: message,
        token_count: message.split(/\s+/).length,
        embedding: userEmbedding,
        customer_context: { tier: customerProfile.financial.tier, products: productsOwned },
      },
      {
        conversation_id: conversationId,
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
            .eq('conversation_id', conversationId)
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
        conversationId: conversationId,
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
