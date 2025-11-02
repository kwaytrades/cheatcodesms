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

    // Pre-defined mappings for common columns (case-insensitive)
    // These override AI mapping to ensure accuracy for known fields
    const preMappings: Record<string, string> = {
      'status': 'customer_tier',
      'tier': 'influencer_tier',
      'customer tier': 'customer_tier',
      'influencer tier': 'influencer_tier',
      'total spent': 'total_spent',
      'total_spent': 'total_spent',
      'products': 'products_owned',
      'products owned': 'products_owned',
      'tags': 'tags',
      'address 1': 'address_line1',
      'address1': 'address_line1',
      'address 2': 'address_line2',
      'address2': 'address_line2',
      'ai notes': 'notes',
      'notes': 'notes',
      'email': 'email',
      'first name': 'first_name',
      'firstname': 'first_name',
      'last name': 'last_name',
      'lastname': 'last_name',
      'name': 'full_name',
      'phone': 'phone_number',
      'phone number': 'phone_number',
      'city': 'city',
      'state': 'state',
      'zip': 'postal_code',
      'postal code': 'postal_code',
      'zipcode': 'postal_code',
      'country': 'country',
      // Influencer-specific mappings
      'platform': 'platform',
      'handle': 'social_handle',
      'social handle': 'social_handle',
      'followers': 'follower_count',
      'follower count': 'follower_count',
      'engagement rate': 'engagement_rate',
      'engagementrate': 'engagement_rate',
      'niche': 'niche_categories',
      'niche categories': 'niche_categories',
    };

    // Define valid contact fields
    const validFields = [
      // Core contact fields
      'email', 'first_name', 'last_name', 'full_name', 'phone_number',
      
      // Scoring and status
      'lead_status', 'lead_score', 'engagement_score', 'total_spent',
      'customer_tier', 'likelihood_to_buy_score', 'engagement_level',
      
      // Arrays (semicolon-separated in CSV)
      'tags', 'products_interested', 'products_owned',
      
      // Address fields
      'address_line1', 'address_line2', 'city', 'state', 'postal_code', 'country',
      
      // Transaction fields
      'amount', 'payment_status', 'transaction_date', 'product_name',
      'dispute_status', 'disputed_amount', 'has_disputed',
      
      // Engagement tracking
      'webinar_attendance', 'form_submissions', 'quiz_responses',
      'last_purchase_date',
      
      // Influencer/Media fields
      'platform', 'social_handle', 'follower_count', 'avg_views', 
      'engagement_rate', 'influencer_tier', 'niche_categories', 'content_topics',
      
      // Other
      'notes', 'lead_source', 'utm_campaign', 'referrer', 'metadata',
      'trading_experience', 'account_size', 'risk_tolerance', 'goals',
      'time_availability', 'assets_traded', 'trading_style',
      'subscription_status', 'sentiment', 'objections'
    ];

    // Apply pre-mappings first
    const mapping: Record<string, string> = {};
    const unmappedHeaders: string[] = [];
    
    headers.forEach((header: string) => {
      const normalized = header.toLowerCase().trim();
      if (preMappings[normalized]) {
        mapping[header] = preMappings[normalized];
        console.log(`Pre-mapped: "${header}" → ${preMappings[normalized]}`);
      } else {
        unmappedHeaders.push(header);
      }
    });

    // If all headers are pre-mapped, return early
    if (unmappedHeaders.length === 0) {
      console.log("All headers pre-mapped:", mapping);
      return new Response(
        JSON.stringify({ mapping }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Unmapped headers to send to AI:", unmappedHeaders);

    const prompt = `You are a CSV column mapping expert. Analyze these CSV headers and map them to database fields.

CSV Headers: ${unmappedHeaders.join(', ')}
Sample Row Values: ${unmappedHeaders.map(h => {
      const idx = headers.indexOf(h);
      return sampleRow[idx] || 'N/A';
    }).join(' | ')}

Valid Database Fields: ${validFields.join(', ')}

IMPORTANT CONTEXT-AWARE MAPPING RULES:
- If CSV contains 'Platform', 'Handle', 'Followers' columns → This is INFLUENCER/MEDIA data
  - Map 'Tier' to 'influencer_tier' (values: nano, micro, mid, macro, mega)
  - Do NOT map anything to 'customer_tier'
- If CSV contains 'Total Spent', 'Products', customer data → This is CUSTOMER data
  - Map 'Tier'/'Status' to 'customer_tier' (values: LEAD, Level 1-3, VIP, SHITLIST)
  - Do NOT map anything to 'influencer_tier'

Rules:
1. Map each CSV header to the most appropriate database field
2. Use exact field names from the valid fields list
3. For unmapped columns, use null
4. Detect data types:
   - Semicolon/comma/pipe separated values → Array fields (tags, products_owned, products_interested)
   - Currency/numeric → total_spent, amount, disputed_amount
   - Date fields → transaction_date, last_purchase_date
   - Status fields → payment_status, dispute_status, lead_status
   
5. Common mappings:
   - Email variations (Email, E-mail, Email Address) → email
   - Name fields (First Name, FirstName, Given Name) → first_name
   - Name fields (Last Name, LastName, Surname, Family Name) → last_name
   - Phone variations (Phone, Mobile, Cell) → phone_number
   - Money fields (Amount, Total, Price, Revenue) → amount or total_spent
   - Product fields (Product, Item, Description) → product_name or products_owned
   - Status fields (Status, Payment Status) → payment_status
   - Address fields:
     * "Address 1", "Address1", "Address Line 1" → address_line1
     * "Address 2", "Address2", "Address Line 2" → address_line2
     * "City" → city
     * "State", "Province" → state
     * "Zip", "Zip Code", "Postal Code" → postal_code
     * "Country" → country
   - Tags/labels (semicolon-separated) → tags (array)
   - Products (semicolon-separated) → products_owned (array)
   - Sources → lead_source
   - Dispute/chargeback → dispute_status, disputed_amount
   - Notes fields (Notes, AI Notes, Comments) → notes

6. Transaction CSV detection:
   - If headers contain "Amount" AND "Status" → this is a transaction CSV
   - Map transaction-specific fields accordingly
   
7. Handle array fields:
   - Products, Tags, Sources → should be marked for array parsing

Return ONLY a JSON object with header:field mappings.
Example: {"email": "email", "first name": "first_name", "products": "products_owned", "tags": "tags", "address 1": "address_line1", "ai notes": "notes"}`;

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
    
    const aiMapping = JSON.parse(jsonStr);
    
    // Merge pre-mappings with AI mappings
    const finalMapping = { ...mapping, ...aiMapping };
    
    console.log("Final mapping:", finalMapping);

    return new Response(
      JSON.stringify({ mapping: finalMapping }),
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
