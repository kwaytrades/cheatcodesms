import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { headers, sampleRow } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Define valid contact fields
    const validFields = [
      'full_name', 'first_name', 'last_name', 'email', 'phone', 
      'lead_status', 'lead_score', 'engagement_score', 'total_spent',
      'company', 'job_title', 'lead_source', 'referrer', 'utm_campaign',
      'trading_experience', 'trading_style', 'account_size', 'risk_tolerance',
      'tags', 'products_owned', 'notes', 'assets_traded'
    ];

    const prompt = `You are a CSV column mapping assistant. Map the following CSV headers to contact database fields.

CSV Headers: ${JSON.stringify(headers)}
Sample Data Row: ${JSON.stringify(sampleRow)}

Valid Database Fields:
${validFields.join(', ')}

Special Instructions:
- "tags" and "products_owned" should be arrays (comma/semicolon/pipe separated in CSV)
- "lead_score", "engagement_score", "total_spent" are numeric
- "lead_status" should be one of: new, contacted, qualified, converted, lost
- Map similar column names intelligently (e.g., "name" -> "full_name", "product" -> "products_owned")
- If a CSV column doesn't match any field, map it to null

Return ONLY a JSON object mapping each CSV header to a database field or null. Example:
{"name": "full_name", "email address": "email", "products": "products_owned", "unknown_column": null}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a helpful assistant that maps CSV columns to database fields. Always respond with valid JSON only." },
          { role: "user", content: prompt }
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("AI API error:", response.status, error);
      throw new Error("AI mapping failed");
    }

    const aiData = await response.json();
    const content = aiData.choices[0].message.content;
    
    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = content;
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }
    
    const mapping = JSON.parse(jsonStr);

    return new Response(
      JSON.stringify({ mapping }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
