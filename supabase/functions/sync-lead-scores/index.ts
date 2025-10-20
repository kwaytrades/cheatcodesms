import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to detect intent signals
function detectIntentSignals(text: string): number {
  const lowerText = text.toLowerCase();
  let signals = 0;
  
  // Ultra high intent - budget/money mentions (10 points each)
  const budgetRegex = /(\$|usd|dollar|k\b|thousand|million)\s*\d+|\d+\s*(\$|k\b|dollar|thousand)/gi;
  const budgetMatches = text.match(budgetRegex);
  if (budgetMatches) {
    signals += budgetMatches.length * 10;
  }
  
  // VIP/Premium tier interest (8 points)
  const premiumPhrases = ['vip', 'premium', 'elite', 'platinum', 'exclusive'];
  premiumPhrases.forEach(phrase => {
    if (lowerText.includes(phrase)) signals += 8;
  });
  
  // Product interest mentions (5 points each)
  const productPhrases = [
    'interested in', 'want to buy', 'looking for', 'need the', 'get the',
    'purchase', 'textbook', 'course', 'mentorship', 'coaching', 'training'
  ];
  productPhrases.forEach(phrase => {
    if (lowerText.includes(phrase)) signals += 5;
  });
  
  // High intent questions (3 points each)
  const intentQuestions = [
    'how much', 'what is the price', 'how do i', 'when can i', 'where do i',
    'what are the next steps', 'how to get started', 'ready to'
  ];
  intentQuestions.forEach(phrase => {
    if (lowerText.includes(phrase)) signals += 3;
  });
  
  // Ready to buy signals (6 points each)
  const buyingPhrases = [
    "let's do it", 'sign me up', 'count me in', "i'm in", "i'll take it",
    'sounds good', 'perfect', "let's go ahead", 'yes please'
  ];
  buyingPhrases.forEach(phrase => {
    if (lowerText.includes(phrase)) signals += 6;
  });
  
  // Objections (reduce score)
  const objectionPhrases = [
    'too expensive', 'not sure', 'need to think', 'maybe later', 'not ready',
    'not interested', "can't afford"
  ];
  objectionPhrases.forEach(phrase => {
    if (lowerText.includes(phrase)) signals -= 3;
  });
  
  return Math.max(0, signals);
}

// Calculate dynamic lead score for a contact
async function calculateLeadScore(
  contactId: string,
  aiProfile: any,
  supabase: any,
  lovableApiKey: string
): Promise<{ score: number; status: string }> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  // Get activities
  const { data: activities } = await supabase
    .from('contact_activities')
    .select('activity_type')
    .eq('contact_id', contactId)
    .gte('created_at', thirtyDaysAgo.toISOString());
  
  // Get purchases
  const { data: purchases } = await supabase
    .from('purchases')
    .select('id')
    .eq('contact_id', contactId)
    .eq('status', 'completed');
  
  // Get conversation and messages
  const { data: conversations } = await supabase
    .from('conversations')
    .select('id')
    .eq('contact_id', contactId);
  
  let allMessages: any[] = [];
  if (conversations && conversations.length > 0) {
    for (const conv of conversations) {
      const { data: messages } = await supabase
        .from('messages')
        .select('body, sender, created_at')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (messages) allMessages.push(...messages);
    }
  }
  
  // Calculate base scores (reduced weight - max 30 points total)
  const emailOpens = activities?.filter((a: any) => a.activity_type === 'email_open').length || 0;
  const smsReplies = activities?.filter((a: any) => a.activity_type === 'sms_reply').length || 0;
  const purchaseCount = purchases?.length || 0;
  
  const emailScore = Math.min(emailOpens * 1, 10);
  const smsScore = Math.min(smsReplies * 2, 10);
  const purchaseScore = Math.min(purchaseCount * 5, 10);
  
  // Calculate conversation intelligence score (0-70 points - MUCH higher weight)
  let conversationScore = 0;
  
  // Product interests (0-15)
  const productInterests = aiProfile?.interests?.length || 0;
  conversationScore += Math.min(productInterests * 3, 15);
  
  // Intent signals from messages (0-35 - heavily weighted)
  let intentSignals = 0;
  if (allMessages.length > 0) {
    allMessages.forEach((msg: any) => {
      if (msg.sender === 'customer') {
        intentSignals += detectIntentSignals(msg.body);
      }
    });
  }
  // High intent signals should contribute significantly
  conversationScore += Math.min(intentSignals * 2, 35);
  
  // Sentiment analysis (0-10)
  if (allMessages.length > 0) {
    const recentCustomerMessages = allMessages
      .filter((m: any) => m.sender === 'customer')
      .slice(0, 5)
      .map((m: any) => m.body)
      .join(' ');
    
    if (recentCustomerMessages) {
      try {
        const sentimentResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: 'Analyze sentiment. Return only a number 0-1 (0=negative, 1=positive).' },
              { role: 'user', content: recentCustomerMessages.substring(0, 500) }
            ],
            temperature: 0.3,
          }),
        });
        
        if (sentimentResponse.ok) {
          const sentimentData = await sentimentResponse.json();
          const sentimentText = sentimentData.choices?.[0]?.message?.content || '0.5';
          const sentimentValue = parseFloat(sentimentText.match(/[\d.]+/)?.[0] || '0.5');
          conversationScore += sentimentValue * 10;
        }
      } catch (error) {
        console.error('Sentiment analysis error:', error);
        conversationScore += 5; // neutral default
      }
    }
  }
  
  // Response engagement (0-10)
  if (allMessages.length > 0) {
    const customerMessages = allMessages.filter((m: any) => m.sender === 'customer');
    const responseRate = customerMessages.length / Math.max(allMessages.length, 1);
    conversationScore += responseRate * 10;
  }
  
  console.log(`Scoring for ${contactId}: email=${emailScore}, sms=${smsScore}, purchase=${purchaseScore}, conversation=${conversationScore}, intentSignals=${intentSignals}`);
  
  // Calculate total score
  const totalScore = Math.min(
    Math.round(emailScore + smsScore + purchaseScore + conversationScore),
    100
  );
  
  // Determine status
  let status = 'cold';
  if (totalScore >= 75) status = 'ready_to_buy';
  else if (totalScore >= 50) status = 'hot';
  else if (totalScore >= 25) status = 'warm';
  
  return { score: totalScore, status };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    console.log('Starting lead score sync...');
    
    // Get all contacts
    const { data: contacts, error: contactsError } = await supabase
      .from('contacts')
      .select('id, full_name, ai_profile, lead_score');
    
    if (contactsError) {
      throw contactsError;
    }
    
    if (!contacts || contacts.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No contacts found', updated: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Processing ${contacts.length} contacts...`);
    
    let updated = 0;
    let errors = 0;
    const results: any[] = [];
    
    // Process each contact
    for (const contact of contacts) {
      try {
        console.log(`Processing contact: ${contact.full_name} (${contact.id})`);
        
        const { score, status } = await calculateLeadScore(
          contact.id,
          contact.ai_profile,
          supabase,
          lovableApiKey
        );
        
        const previousScore = contact.lead_score || 0;
        const scoreDiff = score - previousScore;
        
        let trend = 'stable';
        if (scoreDiff > 5) trend = 'up';
        else if (scoreDiff < -5) trend = 'down';
        
        // Update contact
        const { error: updateError } = await supabase
          .from('contacts')
          .update({
            lead_score: score,
            lead_status: status,
            score_trend: trend,
            last_score_update: new Date().toISOString()
          })
          .eq('id', contact.id);
        
        if (updateError) {
          throw updateError;
        }
        
        results.push({
          id: contact.id,
          name: contact.full_name,
          previous_score: previousScore,
          new_score: score,
          status: status,
          trend: trend,
          change: scoreDiff
        });
        
        updated++;
        
        // Log significant changes
        if (Math.abs(scoreDiff) >= 5) {
          await supabase
            .from('contact_activities')
            .insert({
              contact_id: contact.id,
              activity_type: 'lead_score_change',
              description: `Lead score bulk sync: ${previousScore} → ${score}`,
              metadata: {
                old_score: previousScore,
                new_score: score,
                change: scoreDiff,
                reason: 'bulk_sync'
              }
            });
        }
        
      } catch (error) {
        console.error(`Error processing contact ${contact.id}:`, error);
        errors++;
        results.push({
          id: contact.id,
          name: contact.full_name,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    console.log(`Sync complete: ${updated} updated, ${errors} errors`);
    
    return new Response(
      JSON.stringify({
        message: 'Lead score sync completed',
        total_contacts: contacts.length,
        updated: updated,
        errors: errors,
        results: results
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
    
  } catch (error) {
    console.error('Sync error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
