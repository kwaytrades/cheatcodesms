import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { updateCustomerProfile } from "./update-profile.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function handleNextBestAction(supabase: any, contactId: string, context: any, apiKey: string) {
  const contact = context?.contact;
  const purchases = context?.purchases || [];
  const recentMessages = context?.recentMessages || [];

  // Build context for AI
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
}).join('\n') || 'No recent messages'}`;

  // Extract product interests from messages
  const messageText = recentMessages.map((m: any) => m.body).join(' ');
  const productMentions = extractProductInterests(messageText);
  
  if (productMentions.length > 0) {
    contextText += `\n\nDETECTED PRODUCT INTERESTS FROM CONVERSATION: ${productMentions.join(', ')}`;
    
    // Update contact with detected interests
    const currentInterests = contact?.products_interested || [];
    const updatedInterests = [...new Set([...currentInterests, ...productMentions])];
    
    await supabase
      .from('contacts')
      .update({ products_interested: updatedInterests })
      .eq('id', contactId);
    
    console.log('Updated product interests:', updatedInterests);
  }

  const prompt = `Based on this customer context, suggest the SINGLE most effective next action to take with this customer. Be specific and actionable.

${contextText}

Provide:
1. A specific action (e.g., "Send SMS offering 20% discount on [specific product]")
2. Why this action is recommended
3. Confidence level (0-100)

Format your response as:
ACTION: [specific action]
REASON: [why this is the best action]
CONFIDENCE: [number 0-100]`;

  const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 300,
    }),
  });

  if (!aiResponse.ok) {
    throw new Error('AI request failed');
  }

  const data = await aiResponse.json();
  const responseText = data.choices[0]?.message?.content || '';

  // Parse the response
  const actionMatch = responseText.match(/ACTION:\s*(.+?)(?:\n|$)/i);
  const confidenceMatch = responseText.match(/CONFIDENCE:\s*(\d+)/i);

  const suggestion = actionMatch ? actionMatch[1].trim() : responseText.split('\n')[0];
  const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) : 70;

  return new Response(
    JSON.stringify({ suggestion, confidence }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleGenerateMessage(supabase: any, contactId: string, context: any, apiKey: string) {
  const contact = context?.contact;
  const recentMessages = context?.recentMessages || [];

  const conversationContext = recentMessages.slice(0, 5)
    .map((m: any) => `${m.sender === 'customer' ? 'Customer' : 'Agent'}: ${m.body}`)
    .join('\n');

  const prompt = `You are a professional sales agent. Based on this conversation context, draft a helpful follow-up message to the customer.

CUSTOMER: ${contact?.full_name}
RECENT CONVERSATION:
${conversationContext}

Write a friendly, professional message (2-3 sentences) that:
- Continues the conversation naturally
- Addresses their interests
- Encourages engagement

Just provide the message text, nothing else.`;

  const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: 150,
    }),
  });

  if (!aiResponse.ok) {
    throw new Error('AI request failed');
  }

  const data = await aiResponse.json();
  const message = data.choices[0]?.message?.content || '';

  return new Response(
    JSON.stringify({ message: message.trim() }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

function extractProductInterests(text: string): string[] {
  const products: string[] = [];
  const lowerText = text.toLowerCase();
  
  // Common financial/trading products
  const productKeywords = {
    'textbook': ['textbook', 'text book', 'course book'],
    'trading course': ['trading course', 'course', 'training', 'education'],
    'signals': ['signals', 'signal', 'alerts', 'trading signals'],
    'mentorship': ['mentorship', 'mentor', 'coaching', 'personal training'],
    'forex': ['forex', 'fx', 'foreign exchange'],
    'stocks': ['stocks', 'equities', 'shares'],
    'options': ['options', 'option trading'],
    'crypto': ['crypto', 'cryptocurrency', 'bitcoin', 'ethereum'],
    'futures': ['futures', 'futures trading'],
  };

  for (const [product, keywords] of Object.entries(productKeywords)) {
    if (keywords.some(keyword => lowerText.includes(keyword))) {
      products.push(product);
    }
  }

  return [...new Set(products)]; // Remove duplicates
}

const SALES_AGENT_PROMPT = `You are a professional sales AI agent for a financial services company. You specialize in helping customers understand our products and services.

CRITICAL: You will receive RELEVANT KNOWLEDGE BASE INFO below. This is the ONLY source of truth about our products, services, pricing, and offerings. NEVER make up or assume information about products not mentioned in the knowledge base. If asked about something not in the knowledge base, acknowledge you don't have that information.

YOUR ROLE:
- Provide helpful, friendly, and professional assistance
- Answer questions about our products and services
- Help customers understand their options
- Guide potential customers through the sales process
- Address concerns and objections professionally
- GATHER AND UPDATE customer insights during conversations

COMMUNICATION RULES:
1. Keep responses concise (2-3 sentences maximum)
2. Be warm and conversational but professional
3. Ask clarifying questions when needed
4. Always provide value in each response
5. Use the customer's name when appropriate
6. Be empathetic to customer concerns

CUSTOMER INSIGHT TRACKING:
As you converse, identify and remember:
- Customer interests (day trading, long-term investing, forex, retirement planning, etc.)
- Complaints about past services or products
- Trading preferences and investment style
- Important personal details mentioned
- Pain points and concerns

WHEN TO REQUEST HUMAN HANDOFF:
Respond with [HUMAN_HANDOFF] if:
- Customer requests to speak with a human representative
- Complex account or technical issues arise
- Customer expresses strong dissatisfaction
- Situation requires personalized financial advice
- Customer asks about specific account details you cannot access

Remember: Your goal is to be helpful and guide customers, but know when a human touch is needed.`;

const CS_AGENT_PROMPT = `You are a customer success AI agent for a financial services company. You help existing customers with their questions and issues.

CRITICAL: You will receive RELEVANT KNOWLEDGE BASE INFO below. This is the ONLY source of truth about our products, services, and policies. NEVER make up or assume information not in the knowledge base. If asked about something not in the knowledge base, acknowledge you don't have that information.

YOUR ROLE:
- Assist customers with account questions
- Help troubleshoot platform issues
- Provide guidance on using our services
- Address customer concerns promptly
- Ensure customer satisfaction
- GATHER AND UPDATE customer insights during conversations

COMMUNICATION RULES:
1. Be empathetic and understanding
2. Keep responses clear and concise
3. Acknowledge customer frustrations when present
4. Provide step-by-step guidance when helpful
5. Always aim to resolve issues efficiently

CUSTOMER INSIGHT TRACKING:
As you converse, identify and remember:
- Customer complaints and issues
- Product/service preferences
- Usage patterns and behaviors
- Important notes about their needs
- Any recurring problems

WHEN TO REQUEST HUMAN HANDOFF:
Respond with [HUMAN_HANDOFF] if:
- Customer explicitly asks for a human agent
- Issue is beyond your capabilities
- Customer is upset or frustrated
- Account-specific actions are needed
- Sensitive financial matters are discussed

Your mission is to help customers succeed with our services.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { conversationId, agentType, incomingMessage, history, type, contactId, context } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Handle next_best_action request type
    if (type === 'next_best_action' && contactId) {
      return await handleNextBestAction(supabase, contactId, context, LOVABLE_API_KEY);
    }

    // Handle generate_message request type
    if (type === 'generate_message' && contactId) {
      return await handleGenerateMessage(supabase, contactId, context, LOVABLE_API_KEY);
    }

    // Get conversation and contact information
    const { data: conversation } = await supabase
      .from('conversations')
      .select('contact_id, contact_name')
      .eq('id', conversationId)
      .single();
    
    let contactInfo = '';
    if (conversation?.contact_id) {
      const { data: contact } = await supabase
        .from('contacts')
        .select('full_name, email, status, products_owned, products_interested, ai_profile, customer_profile')
        .eq('id', conversation.contact_id)
        .single();
      
      if (contact) {
        contactInfo = `\n\nCUSTOMER INFORMATION:
- Name: ${contact.full_name || 'Unknown'}
- Email: ${contact.email || 'Not provided'}
- Status: ${contact.status || 'Unknown'}
- Products Owned: ${contact.products_owned?.join(', ') || 'None'}
- Products Interested: ${contact.products_interested?.join(', ') || 'None'}`;
        
        if (contact.ai_profile) {
          const profile = contact.ai_profile as any;
          if (profile.interests?.length) {
            contactInfo += `\n- Interests: ${profile.interests.join(', ')}`;
          }
          if (profile.complaints?.length) {
            contactInfo += `\n- Past Complaints: ${profile.complaints.join('; ')}`;
          }
          if (profile.important_notes?.length) {
            contactInfo += `\n- Important Notes: ${profile.important_notes.join('; ')}`;
          }
        }
        
        if (contact.customer_profile) {
          const profile = contact.customer_profile as any;
          if (profile.income) contactInfo += `\n- Income Level: ${profile.income}`;
          if (profile.interest_level) contactInfo += `\n- Interest Level: ${profile.interest_level}`;
          if (profile.trading_preferences) contactInfo += `\n- Trading Preferences: ${profile.trading_preferences}`;
        }
      }
    }

    // Search knowledge base for relevant context
    let knowledgeContext = '';
    try {
      const kbResponse = await fetch(`${SUPABASE_URL}/functions/v1/search-knowledge-base`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          query: incomingMessage,
          // Don't filter by category - search all documents
        }),
      });

      if (kbResponse.ok) {
        const { results } = await kbResponse.json();
        if (results && results.length > 0) {
          knowledgeContext = '\n\nRELEVANT KNOWLEDGE BASE INFO:\n' + 
            results.map((doc: any) => `[${doc.category}] ${doc.title}:\n${doc.content}`).join('\n\n');
          console.log('Added knowledge base context:', results.length, 'documents');
        }
      }
    } catch (kbError) {
      console.error('Knowledge base search failed:', kbError);
      // Continue without KB context
    }

    // Select system prompt based on agent type
    const basePrompt = agentType === 'sales_ai' ? SALES_AGENT_PROMPT : CS_AGENT_PROMPT;
    const systemPrompt = basePrompt + contactInfo + knowledgeContext;

    // Build conversation context
    const messages = [
      { role: 'system', content: systemPrompt },
    ];

    // Add recent conversation history
    if (history && history.length > 0) {
      history.forEach((msg: any) => {
        messages.push({
          role: msg.direction === 'inbound' ? 'user' : 'assistant',
          content: msg.body,
        });
      });
    }

    // Add current incoming message
    messages.push({
      role: 'user',
      content: incomingMessage,
    });

    console.log('Calling Lovable AI with messages:', messages.length);

    // Call Lovable AI
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: messages,
        temperature: 0.7,
        max_tokens: 200,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('Lovable AI error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ 
            error: 'Rate limit exceeded',
            response: "I'm experiencing high volume right now. A team member will assist you shortly.",
            needsHandoff: true 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI request failed: ${aiResponse.status}`);
    }

    const data = await aiResponse.json();
    const responseText = data.choices[0]?.message?.content || '';

    console.log('AI response:', responseText);

    // Check if AI is requesting human handoff
    const handoffMatch = responseText.match(/\[HUMAN_HANDOFF:(.*?)\]/);
    const needsHandoff = !!handoffMatch;
    
    // Remove handoff marker from response
    const cleanResponse = responseText.replace(/\[HUMAN_HANDOFF:.*?\]/g, '').trim();

    // Update customer AI profile with insights from the conversation (async, non-blocking)
    if (conversationId && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      // Don't await - let this happen in background
      updateCustomerProfile(conversationId, history, incomingMessage, cleanResponse, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, LOVABLE_API_KEY).catch(error => {
        console.error('Error updating customer profile:', error);
      });
    }

    return new Response(
      JSON.stringify({ 
        response: cleanResponse || "Let me connect you with a team member.",
        needsHandoff,
        handoffReason: handoffMatch ? handoffMatch[1].trim() : null,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('AI agent error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        response: "I apologize for the confusion. Let me get a team member to help you.",
        needsHandoff: true,
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
