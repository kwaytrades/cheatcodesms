import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * OpenClaw Gateway Integration for CheatCodeSMS
 * 
 * This edge function acts as a bridge between CheatCodeSMS and OpenClaw Gateway,
 * allowing the OpenClaw AI agent to handle all contact conversations with full context.
 * 
 * Expected payload:
 * {
 *   contactId: string;
 *   message: string;
 *   channel?: 'sms' | 'email' | 'whatsapp';
 *   conversationId?: string;
 * }
 */

interface ContactContext {
  name: string;
  email?: string;
  phone?: string;
  customerTier: string;
  totalSpent: number;
  productsOwned: string[];
  productsInterested: string[];
  leadScore: number;
  leadStatus: string;
  lastInteraction?: string;
  conversationHistory: Array<{
    sender: string;
    message: string;
    timestamp: string;
  }>;
  tradingProfile?: {
    interests: string[];
    preferences: Record<string, any>;
    complaints: string[];
    importantNotes: string[];
  };
}

/**
 * Build comprehensive contact context from Supabase
 */
async function buildContactContext(
  supabase: any,
  contactId: string,
  conversationId?: string
): Promise<ContactContext | null> {
  try {
    // Fetch contact data
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select(`
        id,
        full_name,
        email,
        phone,
        customer_tier,
        total_spent,
        products_owned,
        products_interested,
        lead_score,
        lead_status,
        last_interaction_date,
        ai_profile,
        notes
      `)
      .eq('id', contactId)
      .single();

    if (contactError || !contact) {
      console.error('Contact not found:', contactError);
      return null;
    }

    // Fetch conversation history (last 10 messages)
    let conversationHistory: Array<any> = [];
    
    if (conversationId) {
      const { data: messages } = await supabase
        .from('messages')
        .select('sender, body, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (messages) {
        conversationHistory = messages.reverse().map((msg: any) => ({
          sender: msg.sender,
          message: msg.body,
          timestamp: msg.created_at
        }));
      }
    }

    // Fetch recent purchases
    const { data: purchases } = await supabase
      .from('purchases')
      .select('products(name), amount, purchase_date, status')
      .eq('contact_id', contactId)
      .eq('status', 'completed')
      .order('purchase_date', { ascending: false })
      .limit(5);

    return {
      name: contact.full_name || 'Unknown',
      email: contact.email,
      phone: contact.phone,
      customerTier: contact.customer_tier || 'LEAD',
      totalSpent: contact.total_spent || 0,
      productsOwned: contact.products_owned || [],
      productsInterested: contact.products_interested || [],
      leadScore: contact.lead_score || 0,
      leadStatus: contact.lead_status || 'cold',
      lastInteraction: contact.last_interaction_date,
      conversationHistory,
      tradingProfile: contact.ai_profile || {
        interests: [],
        preferences: {},
        complaints: [],
        importantNotes: []
      }
    };
  } catch (error) {
    console.error('Error building contact context:', error);
    return null;
  }
}

/**
 * Format context as natural language for AI agent
 */
function formatContextForAI(context: ContactContext): string {
  const recentPurchases = context.productsOwned.length > 0
    ? `Recently purchased: ${context.productsOwned.join(', ')}`
    : 'No purchases yet';

  const interests = context.productsInterested.length > 0
    ? `Interested in: ${context.productsInterested.join(', ')}`
    : 'No specific product interests recorded';

  const conversationSummary = context.conversationHistory.length > 0
    ? `\n\nRECENT CONVERSATION:\n${context.conversationHistory
        .map(msg => `${msg.sender}: ${msg.message}`)
        .join('\n')}`
    : '\n\nNo previous conversation history';

  const tradingNotes = context.tradingProfile?.importantNotes?.length
    ? `\n\nIMPORTANT NOTES:\n- ${context.tradingProfile.importantNotes.join('\n- ')}`
    : '';

  return `CONTACT: ${context.name}
TIER: ${context.customerTier} (Lead Score: ${context.leadScore}/100, Status: ${context.leadStatus})
SPENDING: $${context.totalSpent} total
PRODUCTS: ${recentPurchases}
INTERESTS: ${interests}
TRADING PROFILE: ${context.tradingProfile?.interests?.join(', ') || 'Not yet determined'}${tradingNotes}${conversationSummary}

Handle this conversation with full awareness of their history, interests, and current journey stage.`;
}

/**
 * Send message to OpenClaw Gateway
 */
async function sendToOpenClaw(
  message: string,
  context: string,
  gatewayUrl: string,
  gatewayToken: string
): Promise<{ response: string; error?: string }> {
  try {
    const payload = {
      target: "agent:main:main",
      message: `[CheatCodeSMS Contact Message]\n\n${context}\n\nCUSTOMER MESSAGE: ${message}\n\nRespond naturally as the CheatCodeSMS AI agent. Keep it conversational and helpful.`,
      waitForReply: true,
      timeoutMs: 30000
    };

    console.log('Sending to OpenClaw Gateway:', {
      url: gatewayUrl,
      hasToken: !!gatewayToken,
      messageLength: message.length
    });

    const response = await fetch(`${gatewayUrl}/api/sessions/send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${gatewayToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenClaw Gateway error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      return {
        response: '',
        error: `Gateway error: ${response.status} - ${errorText}`
      };
    }

    const data = await response.json();
    console.log('OpenClaw response received:', {
      hasReply: !!data.reply,
      replyLength: data.reply?.length || 0
    });

    return {
      response: data.reply || 'I received your message and will get back to you shortly.',
      error: undefined
    };
  } catch (error: any) {
    console.error('Failed to connect to OpenClaw Gateway:', error);
    return {
      response: '',
      error: `Connection error: ${error.message}`
    };
  }
}

/**
 * Main handler
 */
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contactId, message, channel = 'sms', conversationId } = await req.json();

    console.log('🔷 openclaw-agent invoked:', {
      contactId,
      messagePreview: message?.substring(0, 50) + '...',
      channel,
      hasConversationId: !!conversationId
    });

    // Validate required fields
    if (!contactId || !message) {
      return new Response(
        JSON.stringify({ error: 'contactId and message are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const gatewayUrl = Deno.env.get('OPENCLAW_GATEWAY_URL') || 'http://localhost:18789';
    const gatewayToken = Deno.env.get('OPENCLAW_TOKEN');

    if (!gatewayToken) {
      console.error('OPENCLAW_TOKEN not configured');
      return new Response(
        JSON.stringify({ error: 'OpenClaw integration not configured' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Build contact context
    console.log('📊 Building contact context...');
    const context = await buildContactContext(supabase, contactId, conversationId);

    if (!context) {
      return new Response(
        JSON.stringify({ error: 'Contact not found or context unavailable' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Format context for AI
    const formattedContext = formatContextForAI(context);
    console.log('📝 Context formatted:', {
      name: context.name,
      tier: context.customerTier,
      historyLength: context.conversationHistory.length
    });

    // Send to OpenClaw Gateway
    console.log('🚀 Sending to OpenClaw Gateway...');
    const { response: aiResponse, error } = await sendToOpenClaw(
      message,
      formattedContext,
      gatewayUrl,
      gatewayToken
    );

    if (error) {
      // Fallback to existing ai-agent function if OpenClaw is unavailable
      console.warn('⚠️ OpenClaw unavailable, falling back to ai-agent...');
      
      try {
        const fallbackResponse = await supabase.functions.invoke('ai-agent', {
          body: {
            conversationId,
            messages: [
              ...context.conversationHistory.map(msg => ({
                sender: msg.sender,
                body: msg.message
              })),
              {
                sender: 'customer',
                body: message
              }
            ],
            agentType: 'sales'
          }
        });

        if (fallbackResponse.error) {
          throw fallbackResponse.error;
        }

        return new Response(
          JSON.stringify({
            response: fallbackResponse.data?.response || 'I received your message.',
            source: 'fallback',
            warning: error
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
        return new Response(
          JSON.stringify({ 
            error: 'Both OpenClaw and fallback unavailable',
            details: { primary: error, fallback: fallbackError }
          }),
          {
            status: 503,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    }

    // Log successful interaction
    await supabase
      .from('contact_activities')
      .insert({
        contact_id: contactId,
        activity_type: 'ai_conversation',
        description: `OpenClaw agent handled ${channel} message`,
        metadata: {
          channel,
          messagePreview: message.substring(0, 100),
          responsePreview: aiResponse.substring(0, 100),
          source: 'openclaw_gateway'
        }
      });

    console.log('✅ Response delivered successfully');

    return new Response(
      JSON.stringify({
        response: aiResponse,
        source: 'openclaw',
        context: {
          contactName: context.name,
          tier: context.customerTier,
          leadScore: context.leadScore
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('❌ Error in openclaw-agent function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
