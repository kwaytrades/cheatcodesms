import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FilterCondition {
  field: string;
  operator: string;
  value: any;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { filters, limit = 100, offset = 0 } = await req.json();
    
    console.log('Received filters:', JSON.stringify(filters, null, 2));

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let query = supabase.from('contacts').select('*', { count: 'exact' });

    // Apply filters
    if (filters && Array.isArray(filters)) {
      filters.forEach((filter: FilterCondition) => {
        let { field, operator, value } = filter;
        
        // Convert string numbers to actual numbers for numeric comparisons
        if ((operator === 'greater_than' || operator === 'less_than' || 
             operator === 'greater_or_equal' || operator === 'less_or_equal') && 
            typeof value === 'string' && !isNaN(Number(value))) {
          value = Number(value);
        }
        
        console.log(`Applying filter: ${field} ${operator} ${value}`);

        switch (operator) {
          case 'equals':
            query = query.eq(field, value);
            break;
          case 'not_equals':
            query = query.neq(field, value);
            break;
          case 'contains':
            query = query.ilike(field, `%${value}%`);
            break;
          case 'greater_than':
            query = query.gt(field, value);
            break;
          case 'less_than':
            query = query.lt(field, value);
            break;
          case 'greater_or_equal':
            query = query.gte(field, value);
            break;
          case 'less_or_equal':
            query = query.lte(field, value);
            break;
          case 'in':
            query = query.in(field, Array.isArray(value) ? value : [value]);
            break;
          case 'includes': // For array fields
            query = query.contains(field, Array.isArray(value) ? value : [value]);
            break;
          case 'includes_any': // For array fields - contains any
            query = query.overlaps(field, Array.isArray(value) ? value : [value]);
            break;
          case 'is_null':
            query = query.is(field, null);
            break;
          case 'is_not_null':
            query = query.not(field, 'is', null);
            break;
        }
      });
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    return new Response(
      JSON.stringify({ contacts: data, total: count || 0 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Filter contacts error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});