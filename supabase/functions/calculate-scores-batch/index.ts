import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ContactData {
  id: string;
  email?: string;
  total_spent?: number;
  engagement_score?: number;
  disputed_amount?: number;
  has_disputed?: boolean;
  products_owned?: string[];
  tags?: string[];
  lead_status?: string;
  webinar_attendance?: any[];
  form_submissions?: any[];
}

// NEW SCORING LOGIC: Separate engagement-based status from tier
// This calculates "Hot/Warm/Cold" status based on recent engagement, not spending
function calculateScore(contact: ContactData): { score: number; status: string; category: string } {
  let score = 0;
  
  const tags = contact.tags || [];
  const products = contact.products_owned || [];
  const revenue = contact.total_spent || 0;

  // 1. ENGAGEMENT FACTORS (+40 points max)
  let engagementPoints = 0;
  
  // Active engagement tags
  if (tags.some(t => t.includes('Active Engaged'))) engagementPoints += 15;
  if (tags.some(t => t.includes('Daily SMS'))) engagementPoints += 10;
  
  // Email/SMS engagement
  const engagement = contact.engagement_score || 0;
  if (engagement > 50) engagementPoints += 15;
  else if (engagement > 20) engagementPoints += 10;
  
  // Webinar attendance (recent activity signal)
  const webinars = contact.webinar_attendance?.length || 0;
  if (webinars >= 3) engagementPoints += 15;
  else if (webinars >= 1) engagementPoints += 5;
  
  // Form submissions (interest signals)
  const forms = contact.form_submissions?.length || 0;
  if (forms >= 2) engagementPoints += 10;
  else if (forms >= 1) engagementPoints += 5;
  
  score += Math.min(engagementPoints, 40);

  // 2. PURCHASE BEHAVIOR (+35 points max)
  let purchasePoints = 0;
  
  // Multiple products = committed customer
  if (products.length >= 3) purchasePoints += 10;
  else if (products.length >= 1) purchasePoints += 5;
  
  // Premium products (shows high commitment)
  if (products.some(p => p.includes('EYL Bundle'))) purchasePoints += 10;
  if (products.some(p => p.includes('Algo Lifetime'))) purchasePoints += 8;
  if (products.some(p => p.includes('Premium Membership'))) purchasePoints += 8;
  if (products.some(p => p.includes('Masterclass') || p.includes('4-Week Masterclass'))) purchasePoints += 6;
  
  // Recent purchase (TODO: Would need purchase_date to properly calculate recency)
  // For now, having products + engagement suggests recent activity
  if (products.length > 0 && engagement > 30) purchasePoints += 15;
  
  score += Math.min(purchasePoints, 35);

  // 3. NEGATIVE SIGNALS (-50 points max)
  let negativePoints = 0;
  
  // HARD STOP for disputes - forces to Cold/Frozen
  if (contact.has_disputed || (contact.disputed_amount && contact.disputed_amount > 0)) {
    negativePoints += 50;
  }
  
  // Cancellations
  if (tags.some(t => t.includes('Cancelled CCA') || t.includes('Cancelled'))) negativePoints += 15;
  
  // Inactive/Cold signals
  if (tags.some(t => t.includes('Inactive'))) negativePoints += 20;
  if (tags.some(t => t.includes('Cold Contact'))) negativePoints += 15;
  
  // Problematic product
  if (products.some(p => p.includes('10k Challenge'))) negativePoints += 10;
  
  score -= negativePoints;

  // 4. VIP/HIGH-VALUE BONUS (+15 points max)
  // Based on revenue tier (separate from engagement)
  if (revenue >= 3000) score += 15; // VIP tier gets engagement bonus
  else if (revenue >= 1000) score += 10; // Level 3 tier
  else if (revenue >= 500) score += 5; // Level 2 tier

  // Cap score between 0-100
  score = Math.max(0, Math.min(100, score));

  // Determine category based on ENGAGEMENT likelihood to buy
  let category = 'cold';
  if (score >= 75) category = 'hot';
  else if (score >= 50) category = 'warm';
  else if (score >= 30) category = 'neutral';
  else if (score >= 15) category = 'cold';
  else category = 'frozen';

  // Determine status (for lead_status field) - simplified
  let status = 'cold';
  if (score >= 75) status = 'hot';
  else if (score >= 50) status = 'warm';
  else if (score >= 30) status = 'neutral';
  else status = 'cold';

  return { score, status, category };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contactIds } = await req.json();
    
    if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      throw new Error("contactIds array is required");
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`Calculating scores for ${contactIds.length} contacts...`);

    // Process in chunks of 10 to avoid overwhelming the system
    const chunkSize = 10;
    let processed = 0;
    let updated = 0;
    const errors: string[] = [];

    for (let i = 0; i < contactIds.length; i += chunkSize) {
      const chunk = contactIds.slice(i, i + chunkSize);
      
      // Fetch contacts in this chunk
      const { data: contacts, error: fetchError } = await supabase
        .from('contacts')
        .select('id, email, total_spent, engagement_score, disputed_amount, has_disputed, products_owned, tags, lead_status, webinar_attendance, form_submissions')
        .in('id', chunk);

      if (fetchError) {
        console.error(`Error fetching chunk:`, fetchError);
        errors.push(`Fetch error: ${fetchError.message}`);
        continue;
      }

      if (!contacts || contacts.length === 0) {
        console.log(`No contacts found in chunk ${i / chunkSize + 1}`);
        continue;
      }

      // Calculate scores for each contact
      for (const contact of contacts) {
        try {
          const { score, status, category } = calculateScore(contact);
          
          const { error: updateError } = await supabase
            .from('contacts')
            .update({
              lead_score: score,
              likelihood_to_buy_score: score,
              likelihood_category: category,
              lead_status: status,
              last_score_update: new Date().toISOString(),
            })
            .eq('id', contact.id);

          if (updateError) {
            console.error(`Error updating contact ${contact.id}:`, updateError);
            errors.push(`Update error for ${contact.email}: ${updateError.message}`);
          } else {
            updated++;
          }
          
          processed++;
        } catch (err: any) {
          console.error(`Error processing contact ${contact.id}:`, err);
          errors.push(`Processing error for ${contact.id}: ${err?.message || 'Unknown error'}`);
        }
      }

      // Small delay between chunks
      if (i + chunkSize < contactIds.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`Score calculation complete: ${updated}/${processed} contacts updated`);

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        updated,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
