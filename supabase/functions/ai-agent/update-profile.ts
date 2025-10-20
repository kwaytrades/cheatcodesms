import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    .select('ai_profile, full_name')
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

    // Update the contact's AI profile
    await supabase
      .from('contacts')
      .update({ ai_profile: updatedProfile })
      .eq('id', conversation.contact_id);

    console.log('Updated AI profile for contact:', conversation.contact_id);
  } catch (error) {
    console.error('Error in updateCustomerProfile:', error);
    throw error;
  }
}
