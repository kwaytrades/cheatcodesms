import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Detect buying signals in message
function detectBuyingSignals(text: string): { score: number; status: string } {
  const lowerText = text.toLowerCase();
  
  // Ultra-high buying signals (score 85-95)
  const immediateBuyingSignals = /\b(ready to buy|lets? do it|sign me up|im in|ill take it|count me in|where.*(buy|purchase|get)|when can i (buy|start|get)|how do i (buy|purchase))\b/i;
  if (immediateBuyingSignals.test(text)) {
    console.log('🔥 IMMEDIATE BUYING SIGNAL detected');
    return { score: 92, status: 'ready_to_buy' };
  }
  
  // High intent signals (score 70-80)
  const highIntentSignals = /\b(interested in|how much|whats the price|tell me more about|info on|details about)\b/i;
  if (highIntentSignals.test(text)) {
    console.log('🎯 HIGH INTENT signal detected');
    return { score: 75, status: 'hot' };
  }
  
  // Product questions (score 60-70)
  const productQuestions = /\b(where.*(for|is)|what about|do you have|can i get|show me)\b/i;
  if (productQuestions.test(text)) {
    console.log('💡 PRODUCT QUESTION detected');
    return { score: 65, status: 'warm' };
  }
  
  // General engagement (score 50+)
  if (text.trim().length > 10) {
    console.log('💬 GENERAL ENGAGEMENT');
    return { score: 55, status: 'warm' };
  }
  
  return { score: 50, status: 'warm' };
}

// Calculate engagement score based on recency and frequency
function calculateEngagementScore(
  lastMessageDate: string | null,
  messageCount: number
): number {
  if (!lastMessageDate) return 20;
  
  const minutesSinceLastMessage = (Date.now() - new Date(lastMessageDate).getTime()) / 60000;
  
  let recencyScore = 0;
  if (minutesSinceLastMessage < 60) {
    recencyScore = 50; // Within 1 hour = super engaged
  } else if (minutesSinceLastMessage < 1440) {
    recencyScore = 40; // Within 24 hours = highly engaged
  } else if (minutesSinceLastMessage < 10080) {
    recencyScore = 30; // Within 7 days = engaged
  } else if (minutesSinceLastMessage < 43200) {
    recencyScore = 20; // Within 30 days = moderately engaged
  } else {
    recencyScore = 10; // Over 30 days = low engagement
  }
  
  // Frequency score (0-50 points based on total messages)
  let frequencyScore = 0;
  if (messageCount > 100) {
    frequencyScore = 50;
  } else if (messageCount > 50) {
    frequencyScore = 40;
  } else if (messageCount > 20) {
    frequencyScore = 30;
  } else if (messageCount > 10) {
    frequencyScore = 20;
  } else if (messageCount > 5) {
    frequencyScore = 10;
  }
  
  return recencyScore + frequencyScore;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { contactId, messageBody } = await req.json();
    
    if (!contactId) {
      return new Response(JSON.stringify({ error: 'contactId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`📊 Calculating real-time scores for contact: ${contactId}`);

    // Fetch contact data
    const { data: contact } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', contactId)
      .single();

    if (!contact) {
      throw new Error('Contact not found');
    }

    // Get recent conversation history to count total messages
    const { data: conversations } = await supabase
      .from('conversations')
      .select('id')
      .eq('contact_id', contactId);

    let totalMessageCount = 0;
    if (conversations && conversations.length > 0) {
      for (const conv of conversations) {
        const { count } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', conv.id);
        totalMessageCount += count || 0;
      }
    }

    console.log(`💬 Total message count: ${totalMessageCount}`);

    // Analyze message for buying signals
    const buyingSignalAnalysis = messageBody 
      ? detectBuyingSignals(messageBody)
      : { score: 50, status: 'warm' };

    // Calculate engagement score based on recency and frequency
    const engagementScore = calculateEngagementScore(
      contact.last_engagement_date,
      totalMessageCount
    );

    // Determine final lead score (weighted combination)
    // Buying signals: 60%, Engagement: 40%
    const leadScore = Math.min(
      Math.round(buyingSignalAnalysis.score * 0.6 + engagementScore * 0.4),
      100
    );

    // Determine lead status
    let leadStatus = 'cold';
    if (buyingSignalAnalysis.status === 'ready_to_buy' || leadScore >= 85) {
      leadStatus = 'ready_to_buy';
    } else if (leadScore >= 70) {
      leadStatus = 'hot';
    } else if (leadScore >= 50) {
      leadStatus = 'warm';
    }

    console.log(`📈 Scores calculated: lead=${leadScore}, engagement=${engagementScore}, status=${leadStatus}`);

    // Update contact with new scores
    const { error: updateError } = await supabase
      .from('contacts')
      .update({
        lead_score: leadScore,
        lead_status: leadStatus,
        engagement_score: engagementScore,
        last_engagement_date: new Date().toISOString(),
        last_score_update: new Date().toISOString(),
      })
      .eq('id', contactId);

    if (updateError) {
      console.error('Failed to update contact scores:', updateError);
      throw updateError;
    }

    // Also trigger likelihood score recalculation
    try {
      await supabase.functions.invoke('calculate-likelihood-score', {
        body: { contact_id: contactId }
      });
      console.log('✅ Likelihood score recalculated');
    } catch (likelihoodError) {
      console.error('Failed to recalculate likelihood:', likelihoodError);
      // Don't throw - this is optional
    }

    return new Response(
      JSON.stringify({
        success: true,
        leadScore,
        leadStatus,
        engagementScore,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error updating contact scores:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
