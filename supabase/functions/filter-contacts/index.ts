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
    console.log('Filter contacts function called');
    
    const { filters, limit = 100, offset = 0 } = await req.json();
    
    console.log('Received filters:', JSON.stringify(filters, null, 2));
    console.log('Limit:', limit, 'Offset:', offset);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    let query = supabase.from('contacts').select('*', { count: 'exact' });

    // Apply filters
    if (filters && Array.isArray(filters) && filters.length > 0) {
      filters.forEach((filter: FilterCondition) => {
        let { field, operator, value } = filter;
        
        console.log(`Processing filter: ${field} ${operator} ${value} (type: ${typeof value})`);
        
        // Convert string numbers to actual numbers for numeric comparisons
        if ((operator === 'greater_than' || operator === 'less_than' || 
             operator === 'greater_or_equal' || operator === 'less_or_equal') && 
            typeof value === 'string' && !isNaN(Number(value))) {
          value = Number(value);
          console.log(`Converted value to number: ${value}`);
        }

        switch (operator) {
          case 'equals':
            console.log(`Applying equals: ${field} = ${value}`);
            query = query.eq(field, value);
            break;
          case 'not_equals':
            console.log(`Applying not_equals: ${field} != ${value}`);
            query = query.neq(field, value);
            break;
          case 'contains':
            console.log(`Applying contains: ${field} ILIKE %${value}%`);
            query = query.ilike(field, `%${value}%`);
            break;
          case 'greater_than':
            console.log(`Applying greater_than: ${field} > ${value}`);
            query = query.gt(field, value);
            break;
          case 'less_than':
            console.log(`Applying less_than: ${field} < ${value}`);
            query = query.lt(field, value);
            break;
          case 'greater_or_equal':
            console.log(`Applying greater_or_equal: ${field} >= ${value}`);
            query = query.gte(field, value);
            break;
          case 'less_or_equal':
            console.log(`Applying less_or_equal: ${field} <= ${value}`);
            query = query.lte(field, value);
            break;
          case 'in':
            console.log(`Applying in: ${field} IN ${JSON.stringify(value)}`);
            query = query.in(field, Array.isArray(value) ? value : [value]);
            break;
          case 'includes': // For array fields
            console.log(`Applying includes: ${field} CONTAINS ${JSON.stringify(value)}`);
            query = query.contains(field, Array.isArray(value) ? value : [value]);
            break;
          case 'includes_any': // For array fields - contains any
            console.log(`Applying includes_any: ${field} OVERLAPS ${JSON.stringify(value)}`);
            query = query.overlaps(field, Array.isArray(value) ? value : [value]);
            break;
          case 'is_null':
            console.log(`Applying is_null: ${field} IS NULL`);
            query = query.is(field, null);
            break;
          case 'is_not_null':
            console.log(`Applying is_not_null: ${field} IS NOT NULL`);
            query = query.not(field, 'is', null);
            break;
          default:
            console.warn(`Unknown operator: ${operator}`);
        }
      });
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    console.log('Executing query...');
    const { data, error, count } = await query;

    if (error) {
      console.error('Query error:', error);
      throw error;
    }

    console.log(`Query successful. Found ${count} total contacts, returning ${data?.length || 0} contacts`);

    return new Response(
      JSON.stringify({ contacts: data || [], total: count || 0 }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Filter contacts error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error details:', errorMessage);
    
    return new Response(
      JSON.stringify({ error: errorMessage, contacts: [], total: 0 }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
