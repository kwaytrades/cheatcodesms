import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const STOCK_ANALYSIS_PROMPT = `You are an expert stock analyst providing personalized analysis for a {trading_style} trader with {trading_experience} experience.

USER PREFERENCES:
- Trading Style: {trading_style}
- Experience: {trading_experience}
- Interested Sectors: {sectors_of_interest}

STOCK DATA:
Symbol: {symbol}
Current Price: {current_price}
Volume: {volume} (Avg: {avg_volume})

TECHNICAL INDICATORS:
- 20-day SMA: {sma_20} | 50-day SMA: {sma_50} | 200-day SMA: {sma_200}
- RSI (14): {rsi} | MACD: {macd}
- 52-Week High: {high_52w} | Low: {low_52w}
- Support Levels: {support_levels}
- Resistance Levels: {resistance_levels}

YOUR TASK:
1. Assign a technical score (0-100) based on:
   - Trend strength (20 pts)
   - Indicator alignment (20 pts)
   - Volume confirmation (15 pts)
   - Risk/reward ratio (20 pts)
   - Pattern quality (15 pts)
   - Momentum (10 pts)

2. Identify setup type: breakout, reversal, momentum, consolidation, or range-bound

3. Determine entry price, stop loss, and 2 price targets

4. Calculate risk/reward ratio

5. Provide 2-3 sentence reasoning in plain English (max 160 chars)

6. List key risks (1 sentence)

7. Set timeframe: day_trade, swing, or long_term (based on user's style)

8. Sentiment: bullish, bearish, or neutral

Return JSON with this exact structure:
{
  "technical_score": 78,
  "setup_type": "momentum_breakout",
  "entry_price": 175.20,
  "stop_loss": 172.50,
  "price_targets": [180.00, 185.00],
  "risk_reward_ratio": 3.2,
  "reasoning": "Strong volume breakout above 50-day MA. RSI trending up with room to run. Tech sector strength supporting.",
  "key_risks": "Watch $172 support closely. Earnings next week could add volatility.",
  "timeframe": "swing",
  "sentiment": "bullish"
}`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbol, contactId } = await req.json();

    if (!symbol || !contactId) {
      throw new Error('Symbol and contactId are required');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log(`Analyzing ${symbol} for contact ${contactId}`);

    // Check subscription and credits
    const { data: subscription, error: subError } = await supabase
      .from('user_subscriptions')
      .select('*, subscription_tiers(*)')
      .eq('contact_id', contactId)
      .single();

    if (subError && subError.code !== 'PGRST116') {
      console.error('Subscription check error:', subError);
    }

    // Check if user has credits
    if (subscription && subscription.credits_remaining !== null && subscription.credits_remaining <= 0) {
      return new Response(
        JSON.stringify({ 
          error: 'no_credits',
          message: `Out of credits. Upgrade to continue analyzing stocks.`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch market data
    const { data: marketData, error: marketError } = await supabase.functions.invoke('fetch-market-data', {
      body: { symbols: [symbol] }
    });

    if (marketError || !marketData?.quotes?.length) {
      throw new Error(`Unable to fetch market data for ${symbol}`);
    }

    const quote = marketData.quotes[0];
    
    // Get contact profile
    const { data: contact } = await supabase
      .from('contacts')
      .select('trading_style, trading_experience, sectors_of_interest')
      .eq('id', contactId)
      .single();

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Generate analysis with AI
    const analysisPrompt = STOCK_ANALYSIS_PROMPT
      .replace('{trading_style}', contact?.trading_style || 'swing trader')
      .replace('{trading_experience}', contact?.trading_experience || 'intermediate')
      .replace('{sectors_of_interest}', contact?.sectors_of_interest?.join(', ') || 'all sectors')
      .replace('{symbol}', symbol)
      .replace('{current_price}', quote.price?.toString() || 'N/A')
      .replace('{volume}', quote.volume?.toString() || 'N/A')
      .replace('{avg_volume}', quote.avgVolume?.toString() || 'N/A')
      .replace('{sma_20}', quote.sma20?.toString() || 'N/A')
      .replace('{sma_50}', quote.sma50?.toString() || 'N/A')
      .replace('{sma_200}', quote.sma200?.toString() || 'N/A')
      .replace('{rsi}', quote.rsi?.toString() || 'N/A')
      .replace('{macd}', quote.macd?.toString() || 'N/A')
      .replace('{high_52w}', quote.high52w?.toString() || 'N/A')
      .replace('{low_52w}', quote.low52w?.toString() || 'N/A')
      .replace('{support_levels}', 'Auto-calculated')
      .replace('{resistance_levels}', 'Auto-calculated');

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: analysisPrompt }],
        tools: [{
          type: "function",
          function: {
            name: "provide_stock_analysis",
            description: "Provide stock analysis with technical score and recommendations",
            parameters: {
              type: "object",
              properties: {
                technical_score: { type: "number" },
                setup_type: { type: "string" },
                entry_price: { type: "number" },
                stop_loss: { type: "number" },
                price_targets: { type: "array", items: { type: "number" } },
                risk_reward_ratio: { type: "number" },
                reasoning: { type: "string" },
                key_risks: { type: "string" },
                timeframe: { type: "string", enum: ["day_trade", "swing", "long_term"] },
                sentiment: { type: "string", enum: ["bullish", "bearish", "neutral"] }
              },
              required: ["technical_score", "setup_type", "entry_price", "stop_loss", "price_targets", 
                         "risk_reward_ratio", "reasoning", "key_risks", "timeframe", "sentiment"]
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "provide_stock_analysis" } }
      })
    });

    if (!aiResponse.ok) {
      throw new Error('AI analysis failed');
    }

    const aiResult = await aiResponse.json();
    const analysis = JSON.parse(aiResult.choices[0].message.tool_calls[0].function.arguments);

    // Store analysis
    const { data: analysisRecord, error: insertError } = await supabase
      .from('stock_analyses')
      .insert({
        contact_id: contactId,
        symbol,
        analysis_result: analysis,
        technical_score: analysis.technical_score,
        entry_price: analysis.entry_price,
        stop_loss: analysis.stop_loss,
        price_targets: analysis.price_targets,
        risk_reward_ratio: analysis.risk_reward_ratio,
        timeframe: analysis.timeframe,
        setup_type: analysis.setup_type,
        sentiment: analysis.sentiment,
        credits_used: 1
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to store analysis:', insertError);
    }

    // Deduct credit if not unlimited
    if (subscription && subscription.credits_remaining !== null) {
      const { error: updateError } = await supabase
        .from('user_subscriptions')
        .update({ credits_remaining: subscription.credits_remaining - 1 })
        .eq('id', subscription.id);

      if (updateError) {
        console.error('Failed to deduct credit:', updateError);
      }

      // Log credit usage
      await supabase.from('analysis_credits_log').insert({
        contact_id: contactId,
        subscription_id: subscription.id,
        credits_before: subscription.credits_remaining,
        credits_after: subscription.credits_remaining - 1,
        credits_used: 1,
        action_type: 'analysis_request',
        analysis_id: analysisRecord?.id
      });
    }

    return new Response(
      JSON.stringify({
        analysis,
        analysisId: analysisRecord?.id,
        creditsRemaining: subscription ? (subscription.credits_remaining !== null ? subscription.credits_remaining - 1 : 'unlimited') : 10
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in analyze-stock:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
