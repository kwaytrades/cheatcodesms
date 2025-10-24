import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function sendTwilioSMS(to: string, body: string) {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const fromNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

  if (!accountSid || !authToken || !fromNumber) {
    throw new Error('Twilio credentials not configured');
  }

  const auth = btoa(`${accountSid}:${authToken}`);
  
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: to,
        From: fromNumber,
        Body: body,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Twilio SMS failed: ${response.status}`);
  }

  return await response.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting watchlist monitoring...');

    // Fetch active watchlists
    const { data: watchlists, error: watchlistError } = await supabase
      .from('user_watchlists')
      .select('*, contacts(phone_number, full_name, trading_style)')
      .eq('status', 'watching')
      .eq('alert_triggered', false);

    if (watchlistError) {
      console.error('Error fetching watchlists:', watchlistError);
      throw watchlistError;
    }

    if (!watchlists || watchlists.length === 0) {
      console.log('No active watchlists to monitor');
      return new Response(
        JSON.stringify({ processed: 0, message: 'No active watchlists' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Monitoring ${watchlists.length} watchlist items`);

    let alertsSent = 0;

    for (const item of watchlists) {
      try {
        // Fetch current price
        const { data: marketData, error: marketError } = await supabase.functions.invoke('fetch-market-data', {
          body: { symbols: [item.symbol] }
        });

        if (marketError || !marketData?.quotes?.length) {
          console.error(`Failed to fetch data for ${item.symbol}:`, marketError);
          continue;
        }

        const currentPrice = marketData.quotes[0]?.price;

        if (!currentPrice) {
          console.log(`No price data for ${item.symbol}`);
          continue;
        }

        console.log(`${item.symbol}: Current $${currentPrice}, Target $${item.target_entry_price}`);

        // Check trigger condition (price at or below target)
        if (currentPrice <= item.target_entry_price) {
          // Send SMS alert
          const alertMessage = `🚨 ALERT: ${item.symbol} hit your entry at $${currentPrice.toFixed(2)}!

Your target: $${item.target_entry_price}
Stop loss: $${item.stop_loss || 'Not set'}

${item.notes || ''}

Reply "REMOVE ${item.symbol}" to clear this alert.`;

          await sendTwilioSMS(item.contacts.phone_number, alertMessage);

          // Mark as triggered
          await supabase
            .from('user_watchlists')
            .update({ 
              alert_triggered: true, 
              triggered_at: new Date().toISOString(),
              status: 'triggered'
            })
            .eq('id', item.id);

          // Create contact activity
          await supabase.from('contact_activities').insert({
            contact_id: item.contact_id,
            activity_type: 'watchlist_alert',
            description: `Watchlist alert triggered for ${item.symbol}`,
            metadata: { symbol: item.symbol, price: currentPrice, target: item.target_entry_price }
          });

          // Update engagement tracking
          await supabase
            .from('contacts')
            .update({ 
              last_engagement_date: new Date().toISOString(),
              last_engagement_action: 'watchlist_alert'
            })
            .eq('id', item.contact_id);

          alertsSent++;
          console.log(`✅ Alert sent for ${item.symbol} to ${item.contacts.phone_number}`);
        }
      } catch (itemError) {
        console.error(`Error processing ${item.symbol}:`, itemError);
      }
    }

    console.log(`Monitoring complete. ${alertsSent} alerts sent.`);

    return new Response(
      JSON.stringify({ 
        processed: watchlists.length,
        alertsSent,
        message: `Processed ${watchlists.length} watchlist items, sent ${alertsSent} alerts`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in monitor-watchlists:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
