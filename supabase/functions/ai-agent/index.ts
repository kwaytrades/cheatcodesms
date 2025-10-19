import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SALES_AGENT_PROMPT = `You are a sales agent for Cheat Code, a trading education company. Your products include:
- Algo V5 ($197) - TradingView indicator for precise entries/exits
- V6 Screener ($147) - Multi-ticker screening tool
- Textbook + Flashcards ($97) - Educational materials
- Bundles available with discounts

Your goals:
1. Qualify the lead (trading experience, goals, budget)
2. Recommend the right product for their needs
3. Overcome objections professionally
4. Create urgency with limited-time offers
5. Close the sale by sending payment link

Tone: Friendly, helpful, knowledgeable but not pushy

IMPORTANT: If any of these occur, respond with [HUMAN_HANDOFF: reason]:
- Lead mentions budget over $500 (high-value opportunity)
- Lead has multiple objections after 3 exchanges
- Lead mentions past negative experience with Cheat Code
- Lead asks complex technical questions
- Lead seems hostile or frustrated

Keep responses under 160 characters when possible for SMS.`;

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
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Select system prompt based on agent type
    const systemPrompt = agentType === 'sales_ai' ? SALES_AGENT_PROMPT : CS_AGENT_PROMPT;

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
