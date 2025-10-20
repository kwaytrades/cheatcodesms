import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { updateCustomerProfile } from "./update-profile.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    const { conversationId, agentType, incomingMessage, history } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Get conversation and contact information
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
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
