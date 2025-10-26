import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ContactData {
  total_spent: number;
  tags: string[];
  products_owned: string[];
  webinar_attendance: any[];
  form_submissions: any[];
  quiz_responses: any[];
  last_purchase_date?: string;
  customer_tier?: string;
  has_disputed: boolean;
  last_engagement_date?: string;
  lead_status?: string;
}

interface ScoreBreakdown {
  base: number;
  revenue: number;
  engagement: number;
  negative: number;
  product_experience: number;
  behavioral: number;
  total: number;
}

interface ScoreResult {
  score: number;
  category: 'Hot' | 'Warm' | 'Neutral' | 'Cold' | 'Frozen';
  breakdown: ScoreBreakdown;
}

function calculateLikelihoodScore(contact: ContactData): ScoreResult {
  const breakdown: ScoreBreakdown = {
    base: 50,
    revenue: 0,
    engagement: 0,
    negative: 0,
    product_experience: 0,
    behavioral: 0,
    total: 0
  };

  let score = 50; // Base score

  // 1. REVENUE IMPACT (+30 points max)
  if (contact.total_spent >= 3000) {
    breakdown.revenue = 30;
    score += 30;
  } else if (contact.total_spent >= 1000) {
    breakdown.revenue = 20;
    score += 20;
  } else if (contact.total_spent >= 500) {
    breakdown.revenue = 10;
    score += 10;
  } else if (contact.total_spent > 0) {
    breakdown.revenue = 5;
    score += 5;
  }

  // 2. ENGAGEMENT IMPACT (+20 points max)
  const tags = contact.tags || [];
  const webinarCount = contact.webinar_attendance?.length || 0;
  const formCount = contact.form_submissions?.length || 0;

  if (tags.some(t => t.toLowerCase().includes('active engaged'))) {
    breakdown.engagement += 15;
    score += 15;
  }
  if (tags.some(t => t.toLowerCase().includes('daily sms'))) {
    breakdown.engagement += 10;
    score += 10;
  }
  if (webinarCount >= 3) {
    breakdown.engagement += 10;
    score += 10;
  }
  if (formCount >= 2) {
    breakdown.engagement += 5;
    score += 5;
  }

  // Check last purchase date
  if (contact.last_purchase_date) {
    const daysSincePurchase = Math.floor(
      (Date.now() - new Date(contact.last_purchase_date).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSincePurchase <= 90) {
      breakdown.engagement += 10;
      score += 10;
    }
  }

  // REAL-TIME BOOST: Recent engagement heavily increases score
  if (contact.last_engagement_date) {
    const minutesSinceEngagement = Math.floor(
      (Date.now() - new Date(contact.last_engagement_date).getTime()) / (1000 * 60)
    );
    
    // Active right now or within last hour = +20 points
    if (minutesSinceEngagement <= 60) {
      breakdown.engagement += 20;
      score += 20;
      console.log(`🔥 ACTIVE NOW: +20 points (${minutesSinceEngagement}min ago)`);
    }
    // Within last 24 hours = +10 points
    else if (minutesSinceEngagement <= 1440) {
      breakdown.engagement += 10;
      score += 10;
      console.log(`📱 ACTIVE TODAY: +10 points (${Math.floor(minutesSinceEngagement / 60)}h ago)`);
    }
  }

  // BUYING SIGNAL BOOST: Check lead_status for ready_to_buy
  if (contact.lead_status === 'ready_to_buy') {
    breakdown.engagement += 30;
    score += 30;
    console.log('💰 READY TO BUY: +30 points');
  }

  // 3. NEGATIVE SIGNALS (-50 points max)
  if (contact.customer_tier === 'SHITLIST' || contact.has_disputed) {
    breakdown.negative = -50; // HARD STOP
    score -= 50;
  } else {
    if (tags.some(t => t.toLowerCase().includes('cancelled cca'))) {
      breakdown.negative -= 15;
      score -= 15;
    }
    if (tags.some(t => t.toLowerCase().includes('cold contact'))) {
      breakdown.negative -= 10;
      score -= 10;
    }
    if (tags.some(t => t.toLowerCase().includes('inactive'))) {
      breakdown.negative -= 15;
      score -= 15;
    }
    
    // Old purchase penalty
    if (contact.last_purchase_date) {
      const daysSincePurchase = Math.floor(
        (Date.now() - new Date(contact.last_purchase_date).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSincePurchase > 365) {
        breakdown.negative -= 10;
        score -= 10;
      }
    }
  }

  // 4. PRODUCT EXPERIENCE IMPACT (-25 points max)
  const products = contact.products_owned || [];
  const productTags = tags;

  if (products.some(p => p.toLowerCase().includes('10k challenge')) || 
      productTags.some(t => t.toLowerCase().includes('10k challenge'))) {
    breakdown.product_experience -= 10;
    score -= 10;
  }
  if (products.some(p => p.toLowerCase().includes('ccta'))) {
    breakdown.product_experience -= 8;
    score -= 8;
  }
  if (products.some(p => p.toLowerCase().includes('trade hero'))) {
    breakdown.product_experience -= 3;
    score -= 3;
  }

  // 5. BEHAVIORAL SCORING (+10 points max)
  const quizzes = contact.quiz_responses || [];
  if (quizzes.length > 0) {
    // Simplified quiz scoring - assume good completion
    breakdown.behavioral += 5;
    score += 5;
  }

  // Clamp score between 0-100
  score = Math.max(0, Math.min(100, score));
  breakdown.total = score;

  // Determine category
  let category: 'Hot' | 'Warm' | 'Neutral' | 'Cold' | 'Frozen';
  if (score >= 80) category = 'Hot';
  else if (score >= 60) category = 'Warm';
  else if (score >= 40) category = 'Neutral';
  else if (score >= 20) category = 'Cold';
  else category = 'Frozen';

  return { score, category, breakdown };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { contact_id } = await req.json();

    // Fetch contact data
    const { data: contact, error } = await supabaseClient
      .from('contacts')
      .select('*')
      .eq('id', contact_id)
      .single();

    if (error) throw error;

    const scoreResult = calculateLikelihoodScore(contact);

    console.log('Likelihood score calculated:', { 
      contact_id, 
      email: contact.email, 
      score: scoreResult.score, 
      category: scoreResult.category 
    });

    return new Response(JSON.stringify(scoreResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error calculating likelihood score:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
