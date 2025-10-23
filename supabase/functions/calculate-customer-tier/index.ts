import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TierCalculationInput {
  email: string;
  total_revenue: number;
  disputed_amount: number;
  has_disputed: boolean;
  products_owned?: string[];
}

interface TierResult {
  tier: 'SHITLIST' | 'LEAD' | 'Level 1' | 'Level 2' | 'Level 3' | 'VIP';
  badge_color: string;
  tier_number: number;
}

function calculateTier(input: TierCalculationInput): TierResult {
  const { total_revenue, has_disputed, disputed_amount, products_owned = [] } = input;

  // TIER 0: SHITLIST (Priority 1) - Any disputes
  if (has_disputed || disputed_amount > 0) {
    return {
      tier: 'SHITLIST',
      badge_color: 'black',
      tier_number: -1
    };
  }

  // TIER 0: LEAD - No revenue
  if (total_revenue === 0) {
    return {
      tier: 'LEAD',
      badge_color: 'gray',
      tier_number: 0
    };
  }

  // Check for specific VIP products
  const hasVIPProduct = products_owned.some(p => 
    ['CCTA', 'EYL Bundle', 'Algo Lifetime'].some(vip => 
      p.toLowerCase().includes(vip.toLowerCase())
    )
  );

  // TIER 4: VIP - $3000+ OR specific products
  if (total_revenue >= 3000 || hasVIPProduct) {
    return {
      tier: 'VIP',
      badge_color: 'red',
      tier_number: 4
    };
  }

  // TIER 3: Level 3 - $1000-$2999 OR premium products
  const hasLevel3Product = products_owned.some(p => 
    ['Premium Membership', 'Masterclass', 'Stocks Course'].some(prod => 
      p.toLowerCase().includes(prod.toLowerCase())
    )
  );

  if (total_revenue >= 1000 || hasLevel3Product) {
    return {
      tier: 'Level 3',
      badge_color: 'green',
      tier_number: 3
    };
  }

  // TIER 2: Level 2 - $500-$999 OR mid-tier products
  const hasLevel2Product = products_owned.some(p => 
    ['Textbook', 'Workshop', 'Algo Yearly', 'Algo+Screener'].some(prod => 
      p.toLowerCase().includes(prod.toLowerCase())
    )
  );

  if (total_revenue >= 500 || hasLevel2Product) {
    return {
      tier: 'Level 2',
      badge_color: 'blue',
      tier_number: 2
    };
  }

  // TIER 1: Level 1 - $0.01-$499 OR entry products
  if (total_revenue > 0) {
    return {
      tier: 'Level 1',
      badge_color: 'gray',
      tier_number: 1
    };
  }

  // Default to LEAD
  return {
    tier: 'LEAD',
    badge_color: 'gray',
    tier_number: 0
  };
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

    const { contact_id, email, total_revenue, disputed_amount, has_disputed, products_owned } = await req.json();

    // If contact_id provided, fetch data from database
    let tierInput: TierCalculationInput;
    
    if (contact_id) {
      const { data: contact, error } = await supabaseClient
        .from('contacts')
        .select('email, total_spent, disputed_amount, has_disputed, products_owned')
        .eq('id', contact_id)
        .single();

      if (error) throw error;

      tierInput = {
        email: contact.email,
        total_revenue: contact.total_spent || 0,
        disputed_amount: contact.disputed_amount || 0,
        has_disputed: contact.has_disputed || false,
        products_owned: contact.products_owned || []
      };
    } else {
      // Use provided data
      tierInput = {
        email,
        total_revenue: total_revenue || 0,
        disputed_amount: disputed_amount || 0,
        has_disputed: has_disputed || false,
        products_owned: products_owned || []
      };
    }

    const tierResult = calculateTier(tierInput);

    console.log('Tier calculated:', { email: tierInput.email, tier: tierResult.tier, revenue: tierInput.total_revenue });

    return new Response(JSON.stringify(tierResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error calculating tier:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
