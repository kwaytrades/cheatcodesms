import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Message {
  body: string;
  created_at: string;
  direction: 'inbound' | 'outbound';
}

interface ContactContext {
  total_spent?: number;
  products_owned?: string[];
  customer_tier?: string;
}

interface IntentAnalysis {
  intent_level: 'immediate' | 'strong' | 'moderate' | 'low' | 'none';
  intent_score: number;
  confidence: number;
  key_signals: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  next_action: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, contactContext = {} } = await req.json() as {
      messages: Message[];
      contactContext?: ContactContext;
    };

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Build conversation context for LLM
    const conversationText = messages
      .slice(0, 10) // Last 10 messages
      .map((m, i) => `[${i + 1}] ${m.direction === 'inbound' ? 'Customer' : 'Us'}: ${m.body}`)
      .join('\n');

    const systemPrompt = `You are an expert sales intent analyzer. Analyze the customer's recent messages and determine their buying intent.

Context:
- Customer tier: ${contactContext.customer_tier || 'Lead'}
- Previous purchases: ${contactContext.products_owned?.length || 0} products
- Total spent: $${contactContext.total_spent || 0}

Recent conversation (most recent first):
${conversationText}

Analyze the customer's buying intent and respond with a JSON object:
{
  "intent_level": "immediate" | "strong" | "moderate" | "low" | "none",
  "intent_score": 0-100,
  "confidence": 0-1.0,
  "key_signals": ["specific phrase or behavior 1", "phrase 2"],
  "sentiment": "positive" | "neutral" | "negative",
  "next_action": "suggested next step for sales team"
}

Intent Levels:
- immediate (95-100): Explicit buying language ("I want to buy", "sign me up", "where do I pay", "send payment link")
- strong (85-94): Price inquiries, availability questions, timeline questions ("how much", "what's the price", "when can I start")
- moderate (70-84): Interest expressions, feature questions, "tell me more"
- low (40-69): General engagement, product awareness, casual conversation
- none (0-39): Off-topic, support questions, complaints

Return ONLY valid JSON, no additional text.`;

    // Call Lovable AI
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Analyze the buying intent from this conversation.' }
        ],
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI error:', response.status, errorText);
      
      // Fallback response
      return new Response(JSON.stringify({
        intent_level: 'low',
        intent_score: 50,
        confidence: 0.5,
        key_signals: ['Unable to analyze - using fallback'],
        sentiment: 'neutral',
        next_action: 'Continue engagement'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    let analysis: IntentAnalysis;
    try {
      analysis = JSON.parse(content);
    } catch (parseError) {
      console.error('Failed to parse LLM response:', content);
      // Fallback
      analysis = {
        intent_level: 'low',
        intent_score: 50,
        confidence: 0.5,
        key_signals: ['Parse error - using fallback'],
        sentiment: 'neutral',
        next_action: 'Continue engagement'
      };
    }

    console.log('Intent analysis result:', analysis);

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in analyze-buying-intent:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      intent_level: 'low',
      intent_score: 50,
      confidence: 0.5,
      key_signals: [],
      sentiment: 'neutral',
      next_action: 'Continue engagement'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
