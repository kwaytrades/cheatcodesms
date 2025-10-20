import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Helper function to detect intent signals
function detectIntentSignals(text: string): number {
  const highIntentPhrases = [
    'how much', 'price', 'cost', 'when can i', 'ready to', 'sign up',
    'want to buy', 'interested in purchasing', "let's do it", 'how do i get',
    'where do i', 'when does', 'what are the next steps'
  ];
  
  const objectionPhrases = [
    'too expensive', 'not sure', 'need to think', 'maybe later', 'not ready'
  ];
  
  const resolutionPhrases = [
    'that works', 'sounds good', "let's go ahead", 'perfect', 'great',
    'yes please', 'count me in', "i'm in"
  ];
  
  const lowerText = text.toLowerCase();
  let signals = 0;
  
  highIntentPhrases.forEach(phrase => {
    if (lowerText.includes(phrase)) signals += 1;
  });
  
  objectionPhrases.forEach(phrase => {
    if (lowerText.includes(phrase)) signals -= 0.5;
  });
  
  resolutionPhrases.forEach(phrase => {
    if (lowerText.includes(phrase)) signals += 1.5;
  });
  
  return Math.max(0, signals);
}

// Calculate dynamic lead score
async function calculateDynamicLeadScore(
  contactId: string,
  aiProfile: any,
  supabase: any,
  lovableApiKey: string
): Promise<{ score: number; status: string; trend: string }> {
  // Get activity metrics
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const { data: activities } = await supabase
    .from('contact_activities')
    .select('activity_type, created_at')
    .eq('contact_id', contactId)
    .gte('created_at', thirtyDaysAgo.toISOString());
  
  const { data: purchases } = await supabase
    .from('purchases')
    .select('amount')
    .eq('contact_id', contactId)
    .eq('status', 'completed');
  
  const { data: messages } = await supabase
    .from('messages')
    .select('body, sender, created_at')
    .eq('conversation_id', contactId)
    .order('created_at', { ascending: false })
    .limit(10);
  
  // Calculate base scores
  const emailOpens = activities?.filter((a: any) => a.activity_type === 'email_open').length || 0;
  const smsReplies = activities?.filter((a: any) => a.activity_type === 'sms_reply').length || 0;
  const purchaseCount = purchases?.length || 0;
  
  const emailScore = Math.min(emailOpens * 1.5, 15);
  const smsScore = Math.min(smsReplies * 4, 20);
  const purchaseScore = Math.min(purchaseCount * 12.5, 25);
  
  // Calculate conversation intelligence score (0-40 points)
  let conversationScore = 0;
  
  // Product interests (0-10)
  const productInterests = aiProfile?.interests?.length || 0;
  conversationScore += Math.min(productInterests * 2, 10);
  
  // Intent signals from recent messages (0-10)
  let intentSignals = 0;
  if (messages && messages.length > 0) {
    messages.forEach((msg: any) => {
      if (msg.sender === 'customer') {
        intentSignals += detectIntentSignals(msg.body);
      }
    });
  }
  conversationScore += Math.min(intentSignals * 3.3, 10);
  
  // Sentiment analysis (0-10)
  if (messages && messages.length > 0) {
    const recentCustomerMessages = messages
      .filter((m: any) => m.sender === 'customer')
      .slice(0, 3)
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
              { role: 'system', content: 'Analyze sentiment of customer messages. Return only a number between 0 and 1, where 0 is very negative and 1 is very positive.' },
              { role: 'user', content: recentCustomerMessages }
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
  if (messages && messages.length > 0) {
    const customerMessages = messages.filter((m: any) => m.sender === 'customer');
    const responseRate = customerMessages.length / Math.max(messages.length, 1);
    conversationScore += responseRate * 10;
  }
  
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
  
  // Get previous score to calculate trend
  const { data: currentContact } = await supabase
    .from('contacts')
    .select('lead_score')
    .eq('id', contactId)
    .single();
  
  const previousScore = currentContact?.lead_score || 0;
  const scoreDiff = totalScore - previousScore;
  let trend = 'stable';
  if (scoreDiff > 5) trend = 'up';
  else if (scoreDiff < -5) trend = 'down';
  
  return { score: totalScore, status, trend };
}

export async function updateCustomerProfile(
  conversationId: string,
  history: any[],
  incomingMessage: string,
  aiResponse: string,
  supabaseUrl: string,
  supabaseKey: string,
  lovableApiKey: string
) {
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get the conversation to find the contact
  const { data: conversation } = await supabase
    .from('conversations')
    .select('contact_id')
    .eq('id', conversationId)
    .single();

  if (!conversation?.contact_id) return;

  // Get current contact data
  const { data: contact } = await supabase
    .from('contacts')
    .select('ai_profile, full_name, lead_score, last_score_update')
    .eq('id', conversation.contact_id)
    .single();

  if (!contact) return;

  // Build conversation context
  const conversationContext = history
    .slice(-5)
    .map((m: any) => `${m.sender}: ${m.body}`)
    .join('\n');

  // Ask AI to extract insights from this conversation
  const insightPrompt = `Based on this customer conversation, extract any important insights about the customer.

Customer: ${contact.full_name}
Recent conversation:
${conversationContext}
Customer: ${incomingMessage}
Agent: ${aiResponse}

Extract:
1. Any new interests mentioned (e.g., day trading, forex, retirement planning, long-term investing)
2. Any complaints about products or services
3. Any preferences stated (communication style, investment approach, etc.)
4. Any important notes worth remembering

Return ONLY a JSON object with this structure (use empty arrays if nothing found):
{
  "interests": ["interest1", "interest2"],
  "complaints": ["complaint1"],
  "preferences": {"key": "value"},
  "important_notes": ["note1"]
}`;

  try {
    const insightResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You extract customer insights from conversations. Return only valid JSON.' },
          { role: 'user', content: insightPrompt }
        ],
        temperature: 0.3,
      }),
    });

    if (!insightResponse.ok) {
      console.error('Insight extraction failed:', insightResponse.status);
      return;
    }

    const insightData = await insightResponse.json();
    const insightText = insightData.choices?.[0]?.message?.content || '{}';
    
    // Parse the insights
    let insights;
    try {
      // Remove markdown code blocks if present
      const cleanJson = insightText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      insights = JSON.parse(cleanJson);
    } catch {
      insights = { interests: [], complaints: [], preferences: {}, important_notes: [] };
    }

    // Merge with existing AI profile
    const currentProfile = contact.ai_profile || { interests: [], complaints: [], preferences: {}, important_notes: [] };
    const updatedProfile = {
      interests: [...new Set([...(currentProfile.interests || []), ...(insights.interests || [])])],
      complaints: [...new Set([...(currentProfile.complaints || []), ...(insights.complaints || [])])],
      preferences: { ...(currentProfile.preferences || {}), ...(insights.preferences || {}) },
      important_notes: [...new Set([...(currentProfile.important_notes || []), ...(insights.important_notes || [])])]
    };

    // Calculate dynamic lead score
    const { score, status, trend } = await calculateDynamicLeadScore(
      conversation.contact_id,
      updatedProfile,
      supabase,
      lovableApiKey
    );
    
    const previousScore = contact.lead_score || 0;
    const scoreDiff = score - previousScore;
    
    // Calculate engagement velocity (points per day)
    const daysSinceLastUpdate = contact.last_score_update 
      ? (Date.now() - new Date(contact.last_score_update).getTime()) / (1000 * 60 * 60 * 24)
      : 1;
    const engagementVelocity = scoreDiff / Math.max(daysSinceLastUpdate, 0.1);
    
    // Update the contact's AI profile and lead scoring
    await supabase
      .from('contacts')
      .update({ 
        ai_profile: updatedProfile,
        lead_score: score,
        lead_status: status,
        score_trend: trend,
        engagement_velocity: engagementVelocity,
        last_score_update: new Date().toISOString()
      })
      .eq('id', conversation.contact_id);

    console.log(`Updated profile for contact ${conversation.contact_id}: score=${score}, status=${status}, trend=${trend}`);
    
    // Log significant score changes
    if (Math.abs(scoreDiff) >= 5) {
      await supabase
        .from('contact_activities')
        .insert({
          contact_id: conversation.contact_id,
          activity_type: 'lead_score_change',
          description: `Lead score ${trend === 'up' ? 'increased' : 'decreased'} from ${previousScore} to ${score}`,
          metadata: {
            old_score: previousScore,
            new_score: score,
            change: scoreDiff,
            reason: 'conversation_update'
          }
        });
      
      // Create notification for significant status changes
      if (status === 'hot' && previousScore < 50) {
        await supabase
          .from('notifications')
          .insert({
            type: 'lead_status_change',
            title: 'Lead became Hot! 🔥',
            description: `${contact.full_name} is now a hot lead (score: ${score})`,
            contact_id: conversation.contact_id
          });
      } else if (status === 'ready_to_buy' && previousScore < 75) {
        await supabase
          .from('notifications')
          .insert({
            type: 'lead_status_change',
            title: 'Lead Ready to Buy! 🎯',
            description: `${contact.full_name} is ready to buy (score: ${score})`,
            contact_id: conversation.contact_id
          });
      }
    }
  } catch (error) {
    console.error('Error in updateCustomerProfile:', error);
    throw error;
  }
}
