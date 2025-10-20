import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbols = ['SPY', 'QQQ', 'AAPL'] } = await req.json();
    
    const alphaVantageKey = Deno.env.get('ALPHA_VANTAGE_API_KEY');
    const finnhubKey = Deno.env.get('FINNHUB_API_KEY');
    
    if (!alphaVantageKey && !finnhubKey) {
      return new Response(
        JSON.stringify({ 
          error: 'No market data API key configured. Please add ALPHA_VANTAGE_API_KEY or FINNHUB_API_KEY in settings.',
          market_data: null
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const marketData: any = {
      timestamp: new Date().toISOString(),
      quotes: []
    };

    // Try Alpha Vantage first
    if (alphaVantageKey) {
      for (const symbol of symbols.slice(0, 3)) { // Limit to 3 to respect rate limits
        try {
          const response = await fetch(
            `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${alphaVantageKey}`
          );
          const data = await response.json();
          
          if (data['Global Quote']) {
            const quote = data['Global Quote'];
            marketData.quotes.push({
              symbol: symbol,
              price: parseFloat(quote['05. price']),
              change: parseFloat(quote['09. change']),
              change_percent: quote['10. change percent'],
              volume: parseInt(quote['06. volume']),
              source: 'Alpha Vantage'
            });
          }
        } catch (error) {
          console.error(`Error fetching ${symbol}:`, error);
        }
      }
    } 
    // Fallback to Finnhub
    else if (finnhubKey) {
      for (const symbol of symbols.slice(0, 5)) {
        try {
          const response = await fetch(
            `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${finnhubKey}`
          );
          const data = await response.json();
          
          if (data.c) { // current price exists
            marketData.quotes.push({
              symbol: symbol,
              price: data.c,
              change: data.d,
              change_percent: ((data.d / data.pc) * 100).toFixed(2) + '%',
              volume: null,
              source: 'Finnhub'
            });
          }
        } catch (error) {
          console.error(`Error fetching ${symbol}:`, error);
        }
      }
    }

    // Add market summary text
    if (marketData.quotes.length > 0) {
      const summaryParts = marketData.quotes.map((q: any) => 
        `${q.symbol} at $${q.price.toFixed(2)} (${q.change > 0 ? '+' : ''}${q.change_percent})`
      );
      marketData.summary = `Current market: ${summaryParts.join(', ')}`;
    }

    console.log('Market data fetched:', marketData);

    return new Response(
      JSON.stringify({ market_data: marketData }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Market data fetch error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        market_data: null
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
