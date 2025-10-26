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

// Analyze message history with time-decay weighting
function analyzeMessageHistory(messages: any[]): { score: number; insights: any } {
  if (!messages || messages.length === 0) {
    return { score: 50, insights: {} };
  }

  let weightedScore = 0;
  let totalWeight = 0;
  const now = Date.now();
  
  // Track conversation patterns
  let questionCount = 0;
  let buyingSignalEscalation = 0;
  let previousScore = 0;
  
  messages.forEach((msg, index) => {
    const ageInHours = (now - new Date(msg.created_at).getTime()) / 3600000;
    
    // Time decay weight
    let timeWeight = 1.0;
    if (ageInHours < 24) timeWeight = 1.0;        // Last day: full weight
    else if (ageInHours < 168) timeWeight = 0.8;  // Last week: 80%
    else if (ageInHours < 720) timeWeight = 0.5;  // Last month: 50%
    else if (ageInHours < 2160) timeWeight = 0.2; // Last 3 months: 20%
    else timeWeight = 0.1;                         // Older: 10%
    
    // Position weight (more recent messages = higher importance)
    const positionWeight = 1 - (index / messages.length) * 0.3;
    
    // Analyze message for signals
    const signalAnalysis = detectBuyingSignals(msg.body);
    
    // Track buying signal escalation
    if (signalAnalysis.score > previousScore) {
      buyingSignalEscalation += 5;
    }
    previousScore = signalAnalysis.score;
    
    // Count questions (indicates engagement)
    if (msg.body.includes('?')) {
      questionCount++;
    }
    
    // Combined weighted score
    const messageWeight = timeWeight * positionWeight;
    weightedScore += signalAnalysis.score * messageWeight;
    totalWeight += messageWeight;
  });
  
  // Calculate base score
  const baseScore = totalWeight > 0 ? weightedScore / totalWeight : 50;
  
  // Apply bonuses
  let bonusPoints = 0;
  
  // Question density bonus (shows engagement)
  const questionDensity = questionCount / messages.length;
  if (questionDensity > 0.3) bonusPoints += 8;
  else if (questionDensity > 0.15) bonusPoints += 4;
  
  // Buying signal escalation bonus
  bonusPoints += Math.min(buyingSignalEscalation, 15);
  
  // Conversation momentum (recent messages cluster)
  const recentMessages = messages.filter(m => {
    const age = (now - new Date(m.created_at).getTime()) / 3600000;
    return age < 48;
  });
  if (recentMessages.length >= 3) bonusPoints += 10;
  
  const finalScore = Math.min(Math.round(baseScore + bonusPoints), 100);
  
  return {
    score: finalScore,
    insights: {
      messageCount: messages.length,
      questionDensity,
      buyingSignalEscalation,
      recentActivityCount: recentMessages.length,
      bonusPoints
    }
  };
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

    // Fetch contact data with last score update check
    const { data: contact } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', contactId)
      .single();

    if (!contact) {
      throw new Error('Contact not found');
    }

    // Check if score was updated recently (< 5 minutes ago) - avoid duplicate processing
    const lastUpdate = contact.last_score_update ? new Date(contact.last_score_update) : null;
    if (lastUpdate && (Date.now() - lastUpdate.getTime()) < 5 * 60 * 1000) {
      console.log('⏭️  Score updated recently, skipping to avoid duplicate processing');
      return new Response(
        JSON.stringify({
          success: true,
          cached: true,
          leadScore: contact.lead_score,
          leadStatus: contact.lead_status,
          engagementScore: contact.engagement_score,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get recent conversation history - fetch last 50 messages for analysis
    const { data: conversations } = await supabase
      .from('conversations')
      .select('id')
      .eq('contact_id', contactId);

    let recentMessages: any[] = [];
    let totalMessageCount = 0;
    
    if (conversations && conversations.length > 0) {
      for (const conv of conversations) {
        const { data: messages } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: false })
          .limit(50);
        
        if (messages) {
          recentMessages.push(...messages);
        }
      }
      
      // Sort all messages by recency
      recentMessages.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      totalMessageCount = recentMessages.length;
    }

    console.log(`💬 Analyzing ${totalMessageCount} recent messages`);

    // Analyze full message history with time-decay weighting
    const messageAnalysis = analyzeMessageHistory(recentMessages);
    console.log(`📈 Message analysis:`, messageAnalysis.insights);

    // Calculate engagement score based on recency and frequency
    const engagementScore = calculateEngagementScore(
      contact.last_engagement_date,
      totalMessageCount
    );

    // Determine final lead score (weighted combination)
    // Message history analysis: 70%, Engagement: 30%
    const leadScore = Math.min(
      Math.round(messageAnalysis.score * 0.7 + engagementScore * 0.3),
      100
    );

    // Determine lead status based on final score
    let leadStatus = 'cold';
    if (leadScore >= 85) {
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
