import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const INTENT_CLASSIFIER_PROMPT = `You are a stock trading assistant intent classifier. Analyze the incoming message and determine what the user wants.

USER PROFILE:
- Trading Experience: {trading_experience}
- Trading Style: {trading_style}
- Onboarding Phase: {onboarding_phase}

VALID INTENTS:
1. stock_analysis - User wants analysis on a specific stock (e.g., "AAPL", "analyze Tesla", "what about NVDA")
2. watchlist_add - User wants to add stock to watchlist (e.g., "WATCH AAPL 175", "add to watchlist")
3. watchlist_view - User wants to see their watchlist (e.g., "show my watchlist", "WATCHLIST")
4. watchlist_remove - User wants to remove from watchlist (e.g., "REMOVE 2", "delete TSLA")
5. account_query - User asking about credits/subscription (e.g., "how many credits", "BALANCE")
6. help - User needs help (e.g., "HELP", "what can you do")
7. educational_question - Technical analysis education (e.g., "what is RSI", "how do I read MACD")
8. off_topic - Anything unrelated to stocks/trading
9. onboarding_response - User is answering onboarding questions

ENTITY EXTRACTION:
- ticker_symbol: Extract stock ticker (1-5 uppercase letters) or convert company name to ticker
  * Examples: "AAPL" → AAPL, "Apple" → AAPL, "Tesla" → TSLA, "microsoft" → MSFT
- target_price: Extract numeric price if mentioned
- action: For watchlist commands (add, remove, view)
- watchlist_item_number: For REMOVE commands (extract number)

CLARIFICATION RULES:
- If user mentions multiple tickers: Set clarification_needed=true, ask which one
- If ambiguous command: Ask for clarification
- If company name is unclear: Ask for ticker symbol
- Otherwise: clarification_needed=false

CONFIDENCE SCORING:
- 0.9-1.0: Very clear intent (exact ticker, clear command)
- 0.7-0.9: Likely intent (company name mentioned, recognizable pattern)
- 0.5-0.7: Moderate confidence (ambiguous wording)
- 0.0-0.5: Low confidence (unclear intent)

Return JSON only. No explanations.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, contactProfile = {} } = await req.json();

    if (!message) {
      throw new Error('Message is required');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const systemPrompt = INTENT_CLASSIFIER_PROMPT
      .replace('{trading_experience}', contactProfile.trading_experience || 'Unknown')
      .replace('{trading_style}', contactProfile.trading_style || 'Unknown')
      .replace('{onboarding_phase}', contactProfile.onboarding_phase || 'Complete');

    console.log('Classifying intent for message:', message);

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
          { role: 'user', content: `Classify this message: "${message}"` }
        ],
        tools: [{
          type: "function",
          function: {
            name: "classify_intent",
            description: "Classify user intent and extract entities",
            parameters: {
              type: "object",
              properties: {
                intent: {
                  type: "string",
                  enum: ["stock_analysis", "watchlist_add", "watchlist_view", "watchlist_remove", 
                         "account_query", "help", "educational_question", "off_topic", "onboarding_response"]
                },
                confidence: { type: "number" },
                entities: {
                  type: "object",
                  properties: {
                    ticker_symbol: { type: "string" },
                    target_price: { type: "number" },
                    action: { type: "string" },
                    watchlist_item_number: { type: "number" }
                  }
                },
                clarification_needed: { type: "boolean" },
                clarification_question: { type: "string" }
              },
              required: ["intent", "confidence", "entities", "clarification_needed"]
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "classify_intent" } }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI error:', response.status, errorText);
      throw new Error(`AI classification failed: ${response.status}`);
    }

    const result = await response.json();
    const classification = JSON.parse(result.choices[0].message.tool_calls[0].function.arguments);

    console.log('Classification result:', classification);

    return new Response(JSON.stringify(classification), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error in classify-intent:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
