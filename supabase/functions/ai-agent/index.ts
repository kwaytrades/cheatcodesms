import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============= MERGED FROM update-profile.ts =============

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

// Calculate dynamic lead score
async function calculateDynamicLeadScore(
  contactId: string,
  aiProfile: any,
  supabase: any,
  lovableApiKey: string
): Promise<{ score: number; status: string; trend: string }> {
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
  
  const emailOpens = activities?.filter((a: any) => a.activity_type === 'email_open').length || 0;
  const smsReplies = activities?.filter((a: any) => a.activity_type === 'sms_reply').length || 0;
  const purchaseCount = purchases?.length || 0;
  
  const emailScore = Math.min(emailOpens * 1, 10);
  const smsScore = Math.min(smsReplies * 2, 10);
  const purchaseScore = Math.min(purchaseCount * 5, 10);
  
  let conversationScore = 0;
  const productInterests = aiProfile?.interests?.length || 0;
  conversationScore += Math.min(productInterests * 3, 15);
  
  let intentSignals = 0;
  if (messages && messages.length > 0) {
    messages.forEach((msg: any) => {
      if (msg.sender === 'customer') {
        intentSignals += detectIntentSignals(msg.body);
      }
    });
  }
  conversationScore += Math.min(intentSignals * 2, 35);
  
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
              { role: 'system', content: 'Analyze sentiment. Return only a number 0-1 (0=very negative, 1=very positive).' },
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
        conversationScore += 5;
      }
    }
  }
  
  if (messages && messages.length > 0) {
    const customerMessages = messages.filter((m: any) => m.sender === 'customer');
    const responseRate = customerMessages.length / Math.max(messages.length, 1);
    conversationScore += responseRate * 10;
  }
  
  console.log(`Scoring breakdown for contact: email=${emailScore}, sms=${smsScore}, purchase=${purchaseScore}, conversation=${conversationScore}, intentSignals=${intentSignals}`);
  
  const totalScore = Math.min(
    Math.round(emailScore + smsScore + purchaseScore + conversationScore),
    100
  );
  
  let status = 'cold';
  if (totalScore >= 75) status = 'ready_to_buy';
  else if (totalScore >= 50) status = 'hot';
  else if (totalScore >= 25) status = 'warm';
  
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

async function updateCustomerProfile(
  conversationId: string,
  history: any[],
  incomingMessage: string,
  aiResponse: string,
  supabaseUrl: string,
  supabaseKey: string,
  lovableApiKey: string
) {
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: conversation } = await supabase
    .from('conversations')
    .select('contact_id')
    .eq('id', conversationId)
    .single();

  if (!conversation?.contact_id) return;

  const { data: contact } = await supabase
    .from('contacts')
    .select('ai_profile, full_name, lead_score, last_score_update')
    .eq('id', conversation.contact_id)
    .single();

  if (!contact) return;

  const conversationContext = history
    .slice(-5)
    .map((m: any) => `${m.sender}: ${m.body}`)
    .join('\n');

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
    
    let insights;
    try {
      const cleanJson = insightText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      insights = JSON.parse(cleanJson);
    } catch {
      insights = { interests: [], complaints: [], preferences: {}, important_notes: [] };
    }

    const currentProfile = contact.ai_profile || { interests: [], complaints: [], preferences: {}, important_notes: [] };
    const updatedProfile = {
      interests: [...new Set([...(currentProfile.interests || []), ...(insights.interests || [])])],
      complaints: [...new Set([...(currentProfile.complaints || []), ...(insights.complaints || [])])],
      preferences: { ...(currentProfile.preferences || {}), ...(insights.preferences || {}) },
      important_notes: [...new Set([...(currentProfile.important_notes || []), ...(insights.important_notes || [])])]
    };

    const { score, status, trend } = await calculateDynamicLeadScore(
      conversation.contact_id,
      updatedProfile,
      supabase,
      lovableApiKey
    );
    
    const previousScore = contact.lead_score || 0;
    const scoreDiff = score - previousScore;
    
    const daysSinceLastUpdate = contact.last_score_update 
      ? (Date.now() - new Date(contact.last_score_update).getTime()) / (1000 * 60 * 60 * 24)
      : 1;
    const engagementVelocity = scoreDiff / Math.max(daysSinceLastUpdate, 0.1);
    
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

// ============= END MERGED CODE =============

function extractProductInterests(text: string): string[] {
  const products = [];
  const lowerText = text.toLowerCase();
  
  if (lowerText.includes('day trading') || lowerText.includes('day trader')) products.push('Day Trading');
  if (lowerText.includes('forex') || lowerText.includes('foreign exchange')) products.push('Forex');
  if (lowerText.includes('crypto') || lowerText.includes('bitcoin') || lowerText.includes('ethereum')) products.push('Crypto');
  if (lowerText.includes('options') || lowerText.includes('option trading')) products.push('Options');
  if (lowerText.includes('swing trading') || lowerText.includes('swing trader')) products.push('Swing Trading');
  if (lowerText.includes('stock') || lowerText.includes('stocks') || lowerText.includes('equity')) products.push('Stocks');
  if (lowerText.includes('futures')) products.push('Futures');
  if (lowerText.includes('etf') || lowerText.includes('index fund')) products.push('ETFs');
  
  return products;
}

async function handleNextBestAction(supabase: any, contactId: string, context: any, apiKey: string) {
  const contact = context?.contact;
  const purchases = context?.purchases || [];
  const recentMessages = context?.recentMessages || [];

  // Search knowledge base for relevant context
  let knowledgeContext = "";
  try {
    const messageText = recentMessages.map((m: any) => m.body || m.message_body || '').join(' ');
    const searchQuery = `${contact?.full_name} ${contact?.products_interested?.join(' ')} ${messageText}`.slice(0, 500);
    
    const { data: kbData, error: kbError } = await supabase.functions.invoke('search-knowledge-base', {
      body: { query: searchQuery, matchCount: 3 }
    });
    
    if (!kbError && kbData?.results?.length > 0) {
      knowledgeContext = `\n\nRELEVANT KNOWLEDGE BASE CONTEXT:\n${kbData.results.map((r: any) => 
        `- ${r.title} (${r.category}): ${r.content.slice(0, 200)}...`
      ).join('\n')}`;
    }
  } catch (err) {
    console.log('Knowledge base search failed:', err);
  }

  let contextText = `CONTACT INFORMATION:
- Name: ${contact?.full_name || 'Unknown'}
- Customer Tier: ${contact?.customer_tier || 'LEAD'}
- Likelihood Score: ${contact?.likelihood_to_buy_score || 0}/100 (${contact?.likelihood_category || 'unknown'})
- Engagement Score: ${contact?.engagement_score || 0}/100
- Total Spent: $${contact?.total_spent || 0}
- Products Owned: ${contact?.products_owned?.join(', ') || 'None'}
- Products Interested: ${contact?.products_interested?.join(', ') || 'None identified'}
- Notes: ${contact?.notes || 'No notes'}
- Tags: ${contact?.tags?.join(', ') || 'No tags'}
- Has Disputes: ${contact?.has_disputed ? `YES - $${contact?.disputed_amount || 0} disputed` : 'No'}

RECENT PURCHASES (${purchases.length}):
${purchases.map((p: any) => `- ${p.products?.name}: $${p.amount} on ${new Date(p.purchase_date).toLocaleDateString()}`).join('\n') || 'No purchases yet'}

RECENT CONVERSATION CONTEXT (${recentMessages.length} messages):
${recentMessages.slice(0, 10).map((m: any) => {
  const sender = m.sender === 'customer' ? 'Customer' : m.channel ? `AI (${m.channel})` : 'Agent';
  const body = m.body || m.message_body || '';
  return `${sender}: ${body}`;
}).join('\n') || 'No recent messages'}${knowledgeContext}`;

  const messageText = recentMessages.map((m: any) => m.body).join(' ');
  const productMentions = extractProductInterests(messageText);
  
  if (productMentions.length > 0) {
    contextText += `\n\nDETECTED PRODUCT INTERESTS FROM CONVERSATION: ${productMentions.join(', ')}`;
    
    const currentInterests = contact?.products_interested || [];
    const updatedInterests = [...new Set([...currentInterests, ...productMentions])];
    
    await supabase
      .from('contacts')
      .update({ products_interested: updatedInterests })
      .eq('id', contactId);
  }

  const prompt = `You are an elite customer success strategist with deep expertise in sales psychology and customer behavior analysis. Based on the comprehensive contact data below, suggest ONE highly strategic next best action.

${contextText}

STRATEGIC ANALYSIS FRAMEWORK:
1. Customer Journey Stage: Where are they in the buying journey?
2. Engagement Signals: What actions indicate readiness or hesitation?
3. Value Proposition: What specific product/service matches their needs?
4. Timing: Is now the optimal time to act?
5. Channel: What communication method will be most effective?

Return a JSON object with:
{
  "suggestion": "One powerful, specific action with clear rationale",
  "confidence": 85,
  "reasoning": "Brief 1-sentence explanation of why this is the best action"
}

The suggestion should be:
- ONE clear, actionable step with specific channel/method
- Data-driven based on likelihood score, engagement, purchase history
- Personalized to this customer's unique situation and interests
- Include the recommended channel (SMS, Email, Call, WhatsApp)
- Under 20 words but highly specific

Examples of excellent suggestions:
- "Send personalized WhatsApp with Crypto course upsell. 85% likelihood + recent interest."
- "Schedule call to address dispute. High value customer at risk of churn."
- "Email VIP tier upgrade offer. Spent $5K, high engagement, ripe for upsell."
- "Follow up SMS on abandoned cart. Product viewed 3x, needs nudge."`;

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          { role: 'system', content: 'You are an elite customer success strategist with expertise in sales psychology, customer behavior analysis, and conversion optimization. Analyze customer data deeply and provide strategic, data-driven recommendations. Return only valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI request failed: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '{}';
    
    const cleanJson = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(cleanJson);
    
    return {
      suggestion: result.suggestion || 'Follow up with personalized message',
      confidence: result.confidence || 50
    };
  } catch (error) {
    console.error('Error in handleNextBestAction:', error);
    return {
      suggestion: 'Review customer profile and reach out',
      confidence: 50
    };
  }
}

async function handleGenerateMessage(supabase: any, contactId: string, context: any, apiKey: string) {
  const contact = context?.contact;
  const purchases = context?.purchases || [];
  const recentMessages = context?.recentMessages || [];

  const contextText = `CONTACT INFORMATION:
- Name: ${contact?.full_name || 'Unknown'}
- Customer Tier: ${contact?.customer_tier || 'LEAD'}
- Likelihood Score: ${contact?.likelihood_to_buy_score || 0}/100
- Total Spent: $${contact?.total_spent || 0}
- Products Owned: ${contact?.products_owned?.join(', ') || 'None'}

RECENT PURCHASES (${purchases.length}):
${purchases.map((p: any) => `- ${p.products?.name}: $${p.amount}`).join('\n') || 'No purchases yet'}

RECENT CONVERSATION (${recentMessages.length} messages):
${recentMessages.slice(0, 5).map((m: any) => {
  const sender = m.sender === 'customer' ? 'Customer' : 'AI';
  const body = m.body || m.message_body || '';
  return `${sender}: ${body}`;
}).join('\n') || 'No recent messages'}`;

  const prompt = `Generate a friendly, professional follow-up message for this customer. Continue the conversation naturally, addressing their interests.

${contextText}

Return a JSON object with:
{
  "message": "The personalized message text"
}

Keep it conversational, under 160 characters for SMS.`;

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You write personalized customer messages. Return only valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI request failed: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '{}';
    
    const cleanJson = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(cleanJson);
    
    return {
      message: result.message || 'Hi! How can we help you today?'
    };
  } catch (error) {
    console.error('Error in handleGenerateMessage:', error);
    return {
      message: 'Hi! How can we help you today?'
    };
  }
}

const SALES_AGENT_PROMPT = `You are Sam, a professional sales AI assistant helping customers discover trading education products.

CRITICAL CONVERSATION MEMORY RULES:
1. NEVER say "Hi Sam!" or re-introduce yourself after the first message
2. If conversation history exists, continue naturally without greetings
3. Reference what the customer previously told you (their name, interests, questions)
4. Build on previous exchanges - don't reset the conversation

CUSTOMER PERSONALIZATION:
- If customer shares their name, USE IT in responses naturally
- Reference their previous questions: "You asked about X earlier..."
- Acknowledge their stated interests and goals
- Use customer profile data (products owned, spend history) to personalize

CONVERSATION EXAMPLES:
First message: "Hey! I'm Sam 👋 I help people find the right trading education..."
Follow-up: "Great question! Our chapters are $4.99 each..." (NO GREETING)
After name shared: "Thanks for sharing, [Name]! Based on what you mentioned..."

COMMUNICATION RULES:
- Keep responses under 160 characters when possible
- Be friendly and conversational, not pushy
- Ask clarifying questions to understand needs
- Focus on value and education, not hard selling
- Use emojis sparingly (max 1-2 per message)
- Reference customer's purchase history and owned products when relevant

HANDOFF CONDITIONS - Request human agent when:
- Customer is frustrated or angry
- Technical issues beyond your scope
- Complex pricing negotiations
- Customer explicitly requests human
- Multiple unresolved objections

When handing off, respond: "Let me connect you with our specialist who can help better. One moment..."`;

const CS_AGENT_PROMPT = `You are a professional customer success AI assistant helping existing customers.

CRITICAL CONVERSATION MEMORY RULES:
1. NEVER re-introduce yourself if you've already done so
2. If conversation history exists, continue naturally without greetings
3. Reference what the customer previously told you
4. Build on previous exchanges - don't reset the conversation

CUSTOMER PERSONALIZATION:
- If customer shares their name, USE IT in responses naturally
- Reference their previous issues: "Regarding the issue you mentioned..."
- Show you remember their context and history
- Use customer profile data to personalize support

COMMUNICATION RULES:
- Keep responses under 160 characters when possible
- Be empathetic and solution-focused
- Acknowledge issues clearly
- Provide clear next steps
- Use emojis sparingly (max 1-2 per message)

HANDOFF CONDITIONS - Request human agent when:
- Customer is very frustrated or threatening chargeback
- Refund requests over $500
- Account access or security issues
- Technical bugs you can't resolve
- Customer explicitly requests human

When handing off, respond: "I understand this needs immediate attention. Connecting you with our team now..."`;

const TEXTBOOK_AGENT_PROMPT = `You are Thomas, an expert trading education assistant with deep knowledge of stock market textbooks.

CRITICAL CONVERSATION MEMORY RULES:
1. NEVER re-introduce yourself if you've already done so
2. If conversation history exists, continue naturally without greetings
3. Reference what the customer previously asked about
4. Build on previous exchanges - don't reset the conversation

CRITICAL KNOWLEDGE BASE RULES:
- ONLY reference chapters that appear in "AVAILABLE CHAPTERS" or "CHAPTER CONTENT" sections
- NEVER claim specific chapters exist unless you see them in the knowledge base context
- If asked about a chapter without knowledge base results, respond: "Let me check what's available in that chapter for you..."
- Use knowledge base as your SINGLE SOURCE OF TRUTH
- If no knowledge base results for a chapter query, say: "I don't have that chapter loaded. Let me check with the team."
- When you have chapter content, cite it specifically: "According to Chapter X..."

CUSTOMER PERSONALIZATION:
- If customer shares their name, USE IT in responses naturally
- Reference their previous questions about specific topics
- Build on what they've already learned

COMMUNICATION RULES:
- Explain concepts clearly with textbook examples
- Reference specific chapters and sections when available
- Break down complex topics into digestible parts
- Encourage questions and deeper exploration
- Keep responses concise (2-3 sentences usually)

NEVER make up chapter content or claim chapters are available without seeing them in the knowledge base results.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { conversationId, agentType = 'sales', messages = [], type, contactId, context } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (type === 'next_best_action') {
      const result = await handleNextBestAction(supabase, contactId, context, lovableApiKey);
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (type === 'generate_message') {
      const result = await handleGenerateMessage(supabase, contactId, context, lovableApiKey);
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: conversation } = await supabase
      .from('conversations')
      .select('*, contacts(*)')
      .eq('id', conversationId)
      .single();

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    const incomingMessage = messages[messages.length - 1]?.content || '';
    
    // Map normalized agent type back to database format for knowledge base filtering
    const dbAgentType = agentType === 'sales' ? 'sales_agent' : 
                        agentType === 'cs' ? 'customer_service' : 
                        agentType; // textbook, webinar, etc. stay the same
    
    // Use agent-specific knowledge base category
    const knowledgeCategory = `agent_${dbAgentType}`;
    console.log(`Searching knowledge base for category: ${knowledgeCategory}`);
    
    // Detect chapter queries
    const chapterQueryMatch = incomingMessage.toLowerCase().match(/(?:whats?|what's|tell me|show me|info|information)?\s*(?:on|about|in|is)?\s*chapter\s*(\d+|one|two|three|four|five|six|seven|eight|nine|ten)/i);
    const isChapterQuery = chapterQueryMatch !== null;
    const matchCount = isChapterQuery ? 12 : 3;
    
    const { data: knowledgeResults } = await supabase.functions.invoke('search-knowledge-base', {
      body: { 
        query: incomingMessage, 
        category: knowledgeCategory,
        matchThreshold: 0.7, 
        matchCount 
      }
    });

    let knowledgeContext = '';
    let availableChapters = '';
    
    if (knowledgeResults?.results?.length > 0) {
      if (isChapterQuery) {
        // Format chapter content clearly
        const chapterContent: any = {};
        knowledgeResults.results.forEach((r: any) => {
          const chNum = r.chapter_number;
          if (chNum) {
            if (!chapterContent[chNum]) {
              chapterContent[chNum] = {
                title: r.chapter_title || `Chapter ${chNum}`,
                sections: []
              };
            }
            chapterContent[chNum].sections.push({
              section: r.section_title || r.title,
              topics: r.topics || [],
              content: r.content.slice(0, 300)
            });
          }
        });
        
        if (Object.keys(chapterContent).length > 0) {
          knowledgeContext = '\n\nCHAPTER CONTENT:\n';
          Object.keys(chapterContent).sort((a, b) => parseInt(a) - parseInt(b)).forEach(chNum => {
            const ch = chapterContent[chNum];
            knowledgeContext += `\nCHAPTER ${chNum}: ${ch.title} (${ch.sections.length} sections)\n`;
            ch.sections.slice(0, 5).forEach((s: any, i: number) => {
              knowledgeContext += `  ${i + 1}. ${s.section}\n`;
              if (s.topics.length > 0) knowledgeContext += `     Topics: ${s.topics.slice(0, 3).join(', ')}\n`;
              knowledgeContext += `     ${s.content}...\n`;
            });
          });
        }
      } else {
        knowledgeContext = `\n\nRELEVANT KNOWLEDGE:\n${knowledgeResults.results.slice(0, 3).map((r: any) => 
          `- ${r.title}: ${r.content.slice(0, 300)}...`
        ).join('\n')}`;
      }
      
      // Get available chapters overview
      try {
        const { data: allChunks } = await supabase
          .from('knowledge_base')
          .select('chunk_metadata')
          .eq('category', knowledgeCategory)
          .not('chunk_metadata', 'is', null)
          .limit(500);
        
        if (allChunks && allChunks.length > 0) {
          const chapterMap = new Map<number, string>();
          allChunks.forEach((chunk: any) => {
            const metadata = chunk.chunk_metadata;
            if (metadata?.chapter_number && metadata?.chapter_title) {
              chapterMap.set(metadata.chapter_number, metadata.chapter_title);
            }
          });
          
          if (chapterMap.size > 0) {
            availableChapters = '\n\nAVAILABLE CHAPTERS:\n';
            Array.from(chapterMap.keys()).sort((a, b) => a - b).forEach(chNum => {
              availableChapters += `- Chapter ${chNum}: ${chapterMap.get(chNum)}\n`;
            });
          }
        }
      } catch (err) {
        console.log('Failed to get chapter overview:', err);
      }
    }

    console.log(`Fetching custom config for agent type: ${dbAgentType}`);
    
    // Fetch custom system prompt from database
    const { data: agentConfig } = await supabase
      .from('agent_type_configs')
      .select('system_prompt, tone, max_messages_per_week, first_message_template')
      .eq('agent_type', dbAgentType)
      .eq('is_active', true)
      .maybeSingle();

    if (agentConfig?.system_prompt) {
      console.log(`Using custom system prompt for ${dbAgentType}`);
    } else {
      console.log(`Using default system prompt for ${agentType}`);
    }

    // Use custom prompt if configured, otherwise use hardcoded defaults
    const systemPrompt = agentConfig?.system_prompt || 
                         (agentType === 'sales' ? SALES_AGENT_PROMPT : 
                          agentType === 'cs' ? CS_AGENT_PROMPT : 
                          TEXTBOOK_AGENT_PROMPT);

    // Extract customer name from messages if not in profile
    let customerName = conversation.contacts?.full_name || 'Unknown';
    if (customerName === 'Unknown' && messages && messages.length > 0) {
      const namePattern = /(?:my name is|i'm|i am|call me)\s+([A-Z][a-z]+)/i;
      for (const msg of messages.slice().reverse()) {
        if (msg.sender === 'customer') {
          const match = (msg.body || msg.content || msg.message)?.match(namePattern);
          if (match) {
            customerName = match[1];
            console.log(`Extracted customer name from messages: ${customerName}`);
            break;
          }
        }
      }
    }

    const customerInfo = `
CUSTOMER CONTEXT:
- Name: ${customerName}
- Tier: ${conversation.contacts?.customer_tier || 'LEAD'}
- Total Spent: $${conversation.contacts?.total_spent || 0}
- Products Owned: ${conversation.contacts?.products_owned?.join(', ') || 'None'}
- Lead Score: ${conversation.contacts?.lead_score || 0}/100${availableChapters}${knowledgeContext}${isChapterQuery ? '\n\nIMPORTANT: Customer asking about chapter. Use ONLY the "CHAPTER CONTENT" above. If no content shown, admit you don\'t have it loaded.' : ''}`;

    // Build conversation history from messages array
    const conversationHistory = (messages || []).map((msg: any) => ({
      role: msg.sender === 'customer' ? 'user' : 'assistant',
      content: msg.body || msg.content || msg.message
    }));

    console.log(`Conversation history contains ${conversationHistory.length} messages`);
    if (conversationHistory.length > 0) {
      console.log('Last 3 messages:', conversationHistory.slice(-3).map((m: any) => ({ role: m.role, preview: m.content.substring(0, 50) })));
    }

    // Build system content separately for Claude API
    const systemContent = systemPrompt + '\n\n' + customerInfo;

    console.log(`Using model: claude-sonnet-4-5 for ${agentType} agent`);
    
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 4096,
        system: systemContent,
        messages: conversationHistory,
      }),
    });

    if (!aiResponse.ok) {
      throw new Error(`AI request failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const responseText = aiData.choices?.[0]?.message?.content || 'I apologize, but I need a moment to process that.';

    const needsHuman = responseText.toLowerCase().includes('connect you with') ||
                       responseText.toLowerCase().includes('specialist') ||
                       responseText.toLowerCase().includes('team now');

    const cleanResponse = responseText
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .trim();

    updateCustomerProfile(
      conversationId,
      conversationHistory,
      incomingMessage,
      cleanResponse,
      supabaseUrl,
      supabaseKey,
      lovableApiKey
    ).catch((error: any) => console.error('Profile update failed:', error));

    return new Response(
      JSON.stringify({
        response: cleanResponse,
        needsHuman,
        agentType
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in ai-agent function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});