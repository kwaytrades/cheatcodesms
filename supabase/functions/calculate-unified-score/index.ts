import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ContactData {
  id: string;
  total_spent?: number;
  products_owned?: string[];
  customer_tier?: string;
  tags?: string[];
  has_disputed?: boolean;
  disputed_amount?: number;
  last_engagement_date?: string;
  last_contact_date?: string;
  webinar_attendance?: any[];
  form_submissions?: any[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contactId, forceRecalculate = false } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch contact data
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', contactId)
      .single();

    if (contactError || !contact) {
      throw new Error('Contact not found');
    }

    console.log(`🎯 [Unified Scorer] Processing contact: ${contactId}`);

    // Fetch recent messages for intent analysis
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('body, created_at, direction')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
    }

    const recentMessages = messages || [];

    // Call LLM intent analyzer
    const { data: intentAnalysis, error: intentError } = await supabase.functions.invoke('analyze-buying-intent', {
      body: {
        messages: recentMessages,
        contactContext: {
          total_spent: contact.total_spent,
          products_owned: contact.products_owned,
          customer_tier: contact.customer_tier
        }
      }
    });

    if (intentError) {
      console.error('Error analyzing intent:', intentError);
    }

    const intent = intentAnalysis || {
      intent_level: 'low',
      intent_score: 50,
      confidence: 0.5,
      key_signals: [],
      sentiment: 'neutral'
    };

    console.log(`🤖 [LLM Intent] Level: ${intent.intent_level}, Score: ${intent.intent_score}, Confidence: ${intent.confidence}`);

    // Calculate negative signals first (can override boost)
    let negativePoints = 0;
    const tags = contact.tags || [];
    
    if (tags.some((t: string) => t.toUpperCase().includes('SHITLIST'))) negativePoints += 50;
    if (contact.has_disputed || (contact.disputed_amount && contact.disputed_amount > 0)) negativePoints += 40;
    if (tags.some((t: string) => t.toLowerCase().includes('cancelled'))) negativePoints += 20;
    if (tags.some((t: string) => t.toLowerCase().includes('inactive'))) negativePoints += 10;

    // INSTANT BOOST OVERRIDE for high-intent signals
    if (intent.intent_level === 'immediate') {
      const finalScore = Math.max(0, Math.min(100, 95 - negativePoints));
      return new Response(JSON.stringify({
        lead_score: finalScore,
        lead_status: finalScore >= 80 ? 'ready_to_buy' : 'hot',
        likelihood_category: finalScore >= 80 ? 'hot' : 'warm',
        breakdown: {
          buyingSignalBoost: 95,
          messageIntelligence: 0,
          purchaseHistory: 0,
          activityEngagement: 0,
          timeDecay: 0,
          negativeSignals: -negativePoints,
          llm_analysis: intent
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else if (intent.intent_level === 'strong') {
      const finalScore = Math.max(0, Math.min(100, 92 - negativePoints));
      return new Response(JSON.stringify({
        lead_score: finalScore,
        lead_status: finalScore >= 80 ? 'ready_to_buy' : 'hot',
        likelihood_category: finalScore >= 80 ? 'hot' : 'warm',
        breakdown: {
          buyingSignalBoost: 92,
          messageIntelligence: 0,
          purchaseHistory: 0,
          activityEngagement: 0,
          timeDecay: 0,
          negativeSignals: -negativePoints,
          llm_analysis: intent
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else if (intent.intent_level === 'moderate') {
      const finalScore = Math.max(0, Math.min(100, 87 - negativePoints));
      return new Response(JSON.stringify({
        lead_score: finalScore,
        lead_status: finalScore >= 80 ? 'ready_to_buy' : 'hot',
        likelihood_category: finalScore >= 80 ? 'hot' : 'warm',
        breakdown: {
          buyingSignalBoost: 87,
          messageIntelligence: 0,
          purchaseHistory: 0,
          activityEngagement: 0,
          timeDecay: 0,
          negativeSignals: -negativePoints,
          llm_analysis: intent
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Normal calculation - Message Intelligence (50 pts max)
    let messageIntelligenceScore = 0;
    
    // 1. LLM Intent Score (30 pts)
    messageIntelligenceScore += (intent.intent_score / 100) * 30;
    
    // 2. Email Engagement (10 pts)
    const { data: emailData } = await supabase
      .from('ai_messages')
      .select('id, opened')
      .eq('contact_id', contactId)
      .eq('channel', 'email');
    
    if (emailData && emailData.length > 0) {
      const opens = emailData.filter((e: any) => e.opened).length;
      const openRate = opens / emailData.length;
      if (openRate >= 0.5) messageIntelligenceScore += 10;
      else if (openRate >= 0.3) messageIntelligenceScore += 7;
      else if (openRate >= 0.1) messageIntelligenceScore += 4;
    }
    
    // 3. SMS Engagement (10 pts)
    const { data: smsReplies } = await supabase
      .from('messages')
      .select('id')
      .eq('contact_id', contactId)
      .eq('direction', 'inbound');
    
    const replyCount = smsReplies?.length || 0;
    if (replyCount >= 5) messageIntelligenceScore += 10;
    else if (replyCount >= 2) messageIntelligenceScore += 6;
    else if (replyCount === 1) messageIntelligenceScore += 3;

    // Purchase History (30 pts max)
    let purchaseScore = 0;
    const totalSpent = contact.total_spent || 0;
    
    // Revenue tiers (20 pts)
    if (totalSpent >= 10000) purchaseScore += 20;
    else if (totalSpent >= 3000) purchaseScore += 15;
    else if (totalSpent >= 1000) purchaseScore += 10;
    else if (totalSpent >= 500) purchaseScore += 7;
    else if (totalSpent >= 1) purchaseScore += 3;
    
    // Product count (10 pts)
    const productCount = contact.products_owned?.length || 0;
    if (productCount >= 4) purchaseScore += 10;
    else if (productCount === 3) purchaseScore += 7;
    else if (productCount === 2) purchaseScore += 5;
    else if (productCount === 1) purchaseScore += 3;

    // Activity Engagement (20 pts max)
    let activityScore = 0;
    
    // Webinar attendance (12 pts)
    const webinarCount = Array.isArray(contact.webinar_attendance) ? contact.webinar_attendance.length : 0;
    if (webinarCount >= 4) activityScore += 12;
    else if (webinarCount >= 2) activityScore += 8;
    else if (webinarCount === 1) activityScore += 4;
    
    // Form submissions (8 pts)
    const formCount = Array.isArray(contact.form_submissions) ? contact.form_submissions.length : 0;
    if (formCount >= 4) activityScore += 8;
    else if (formCount >= 2) activityScore += 5;
    else if (formCount === 1) activityScore += 3;

    // Time Decay Penalty (up to -30)
    let timeDecay = 0;
    const lastEngagement = contact.last_engagement_date || contact.last_contact_date;
    if (lastEngagement) {
      const daysSinceEngagement = (Date.now() - new Date(lastEngagement).getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysSinceEngagement <= 7) timeDecay = 0;
      else if (daysSinceEngagement <= 14) timeDecay = -5;
      else if (daysSinceEngagement <= 30) timeDecay = -10;
      else if (daysSinceEngagement <= 60) timeDecay = -15;
      else if (daysSinceEngagement <= 90) timeDecay = -20;
      else if (daysSinceEngagement <= 180) timeDecay = -25;
      else timeDecay = -30;
    }

    // Purchase Recency Penalty (prevents "just purchased" customers from being READY)
    let purchaseRecencyPenalty = 0;
    const lastPurchaseDate = contact.last_purchase_date;

    if (lastPurchaseDate) {
      const daysSinceLastPurchase = (Date.now() - new Date(lastPurchaseDate).getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysSinceLastPurchase <= 30) {
        purchaseRecencyPenalty = -30;
        console.log(`📉 [Purchase Recency] Recent purchase (${Math.floor(daysSinceLastPurchase)} days) → -30 pts`);
      } else if (daysSinceLastPurchase <= 60) {
        purchaseRecencyPenalty = -20;
        console.log(`📉 [Purchase Recency] Purchase within 60 days (${Math.floor(daysSinceLastPurchase)} days) → -20 pts`);
      } else if (daysSinceLastPurchase <= 90) {
        purchaseRecencyPenalty = -10;
        console.log(`📉 [Purchase Recency] Purchase within 90 days (${Math.floor(daysSinceLastPurchase)} days) → -10 pts`);
      } else {
        console.log(`✅ [Purchase Recency] Last purchase ${Math.floor(daysSinceLastPurchase)} days ago → No penalty`);
      }
    }

    // Calculate final score
    const rawScore = messageIntelligenceScore + purchaseScore + activityScore + timeDecay - negativePoints + purchaseRecencyPenalty;
    const finalScore = Math.max(0, Math.min(100, rawScore));

    console.log(`📊 [Score Breakdown] Messages: ${messageIntelligenceScore.toFixed(1)}, Purchase: ${purchaseScore}, Activity: ${activityScore}, Decay: ${timeDecay}, Negative: ${-negativePoints}, Recency: ${purchaseRecencyPenalty}`);

    // Determine status
    let status = 'cold';
    let category = 'cold';
    
    if (finalScore >= 80) {
      status = 'ready_to_buy';
      category = 'hot';
    } else if (finalScore >= 70) {
      status = 'hot';
      category = 'hot';
    } else if (finalScore >= 50) {
      status = 'warm';
      category = 'warm';
    } else if (finalScore >= 30) {
      status = 'neutral';
      category = 'warm';
    } else {
      status = 'cold';
      category = 'cold';
    }

    console.log(`✅ [Final Score] Contact: ${contactId}, Score: ${finalScore}, Status: ${status}, Category: ${category}`);

    return new Response(JSON.stringify({
      likelihood_to_buy_score: finalScore,
      lead_status: status,
      likelihood_category: category,
      breakdown: {
        messageIntelligence: messageIntelligenceScore,
        purchaseHistory: purchaseScore,
        activityEngagement: activityScore,
        timeDecay,
        negativeSignals: -negativePoints,
        purchaseRecencyPenalty,
        llm_analysis: intent
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ [Unified Scorer Error]:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
