import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SALES_AGENT_PROMPT = `You are a sales agent for Cheat Code, a trading education company. Your products include:
- Algo V5 ($197) - TradingView indicator for precise entries/exits
- V6 Screener ($147) - Multi-ticker screening tool
- Textbook + Flashcards ($97) - Educational materials
- Bundles: Algo + Screener ($297 total, saves $47)

CRITICAL CONVERSATION RULES:
1. NEVER repeat greetings. NEVER say "Thanks for reaching out" more than once in a conversation.
2. Be conversational, not robotic. Avoid: "Great question", "I'd love to help", "Absolutely, I can help"
3. Start with VALUE, not pleasantries. Get straight to the point.
4. Match their energy: If brief, be brief. If detailed, give context.
5. Always include: Answer + Next step/CTA
6. Reference conversation history - don't repeat yourself

Your goals:
1. Qualify the lead (trading experience, goals, style)
2. Recommend the right product for their needs
3. Handle objections directly and honestly
4. Move conversation forward with clear next steps
5. Close by offering payment link

Response patterns:
- First message: "What brings you in?" or "Day trading or swing trading?"
- Price questions: "$147 one-time. Want the link?" (brief and direct)
- Feature questions: Direct answer + benefit + question to qualify
- Objections: Acknowledge directly, reframe, ask what else they need
- Interest: "Cool. Link now or more questions first?"

IMPORTANT: If any of these occur, respond with [HUMAN_HANDOFF: reason]:
- Lead mentions managing $50k+ account or professional trading
- Lead has multiple objections after 3 exchanges
- Lead mentions past negative experience with Cheat Code
- Lead asks about guarantees, returns, or legal questions
- Lead seems hostile or frustrated

Keep responses under 160 characters when possible for SMS. Vary your language. Sound human.`;

const CS_AGENT_PROMPT = `You are a customer success agent for Cheat Code. 

Your goals:
1. Solve customer issues quickly (installation help, usage questions, technical problems)
2. Provide clear, actionable instructions
3. Identify upsell opportunities naturally
4. Prevent churn by ensuring satisfaction

Tone: Patient, empathetic, solution-focused

IMPORTANT: If any of these occur, respond with [HUMAN_HANDOFF: reason]:
- Customer requests refund
- Customer is clearly frustrated or angry
- Technical issue you can't solve (platform bugs, payment issues)
- Customer spent over $500 (VIP treatment needed)
- Customer mentions legal action or public complaints

Keep responses under 160 characters when possible for SMS.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { agentType, incomingMessage, history } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Search knowledge base for relevant context
    let knowledgeContext = '';
    try {
      const kbResponse = await fetch(`${SUPABASE_URL}/functions/v1/search-knowledge-base`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          query: incomingMessage,
          // Don't filter by category - search all documents
        }),
      });

      if (kbResponse.ok) {
        const { results } = await kbResponse.json();
        if (results && results.length > 0) {
          knowledgeContext = '\n\nRELEVANT KNOWLEDGE BASE INFO:\n' + 
            results.map((doc: any) => `[${doc.category}] ${doc.title}:\n${doc.content}`).join('\n\n');
          console.log('Added knowledge base context:', results.length, 'documents');
        }
      }
    } catch (kbError) {
      console.error('Knowledge base search failed:', kbError);
      // Continue without KB context
    }

    // Select system prompt based on agent type
    const basePrompt = agentType === 'sales_ai' ? SALES_AGENT_PROMPT : CS_AGENT_PROMPT;
    const systemPrompt = basePrompt + knowledgeContext;

    // Build conversation context
    const messages = [
      { role: 'system', content: systemPrompt },
    ];

    // Add recent conversation history
    if (history && history.length > 0) {
      history.forEach((msg: any) => {
        messages.push({
          role: msg.direction === 'inbound' ? 'user' : 'assistant',
          content: msg.body,
        });
      });
    }

    // Add current incoming message
    messages.push({
      role: 'user',
      content: incomingMessage,
    });

    console.log('Calling Lovable AI with messages:', messages.length);

    // Call Lovable AI
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: messages,
        temperature: 0.7,
        max_tokens: 200,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('Lovable AI error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ 
            error: 'Rate limit exceeded',
            response: "I'm experiencing high volume right now. A team member will assist you shortly.",
            needsHandoff: true 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI request failed: ${aiResponse.status}`);
    }

    const data = await aiResponse.json();
    const responseText = data.choices[0]?.message?.content || '';

    console.log('AI response:', responseText);

    // Check if AI is requesting human handoff
    const handoffMatch = responseText.match(/\[HUMAN_HANDOFF:(.*?)\]/);
    const needsHandoff = !!handoffMatch;
    
    // Remove handoff marker from response
    const cleanResponse = responseText.replace(/\[HUMAN_HANDOFF:.*?\]/g, '').trim();

    return new Response(
      JSON.stringify({ 
        response: cleanResponse || "Let me connect you with a team member.",
        needsHandoff,
        handoffReason: handoffMatch ? handoffMatch[1].trim() : null,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('AI agent error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        response: "I apologize for the confusion. Let me get a team member to help you.",
        needsHandoff: true,
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
