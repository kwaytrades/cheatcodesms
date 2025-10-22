import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { pageUrl, domain, path } = await req.json();

    console.log('Looking up funnel step for:', { pageUrl, domain, path });

    // Try exact match first
    let { data: step, error } = await supabase
      .from('funnel_steps')
      .select(`
        id,
        funnel_id,
        step_name,
        step_number,
        step_type,
        page_url,
        funnels (
          id,
          name,
          is_active
        )
      `)
      .eq('page_url', pageUrl)
      .single();

    // If no exact match, try wildcard patterns
    if (error || !step) {
      const { data: allSteps } = await supabase
        .from('funnel_steps')
        .select(`
          id,
          funnel_id,
          step_name,
          step_number,
          step_type,
          page_url,
          funnels (
            id,
            name,
            is_active
          )
        `);

      if (allSteps) {
        // Find matching pattern
        step = allSteps.find(s => {
          const pattern = s.page_url;
          
          // Exact match
          if (pattern === pageUrl) return true;
          
          // Wildcard match (e.g., "https://example.com/page*")
          if (pattern.includes('*')) {
            const regexPattern = pattern.replace(/\*/g, '.*');
            const regex = new RegExp(`^${regexPattern}$`);
            if (regex.test(pageUrl)) return true;
          }
          
          // Domain match (e.g., "example.com/*")
          if (pattern.includes('/*') && domain) {
            const domainPattern = pattern.split('/*')[0];
            if (pageUrl.includes(domainPattern)) return true;
          }
          
          // Path match (e.g., "*/checkout")
          if (pattern.startsWith('*/') && path) {
            const pathPattern = pattern.substring(1);
            if (path === pathPattern || path.startsWith(pathPattern)) return true;
          }
          
          return false;
        }) || null;
      }
    }

    if (!step) {
      console.log('No matching funnel step found');
      return new Response(
        JSON.stringify({ 
          message: 'No matching funnel step found',
          pageUrl,
          domain,
          path
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }

    // Check if funnel is active
    const funnel = Array.isArray(step.funnels) ? step.funnels[0] : step.funnels;
    if (!funnel?.is_active) {
      console.log('Funnel is not active');
      return new Response(
        JSON.stringify({ message: 'Funnel is not active' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }

    console.log('Funnel step found:', {
      funnel_id: step.funnel_id,
      step_id: step.id,
      step_name: step.step_name
    });

    return new Response(
      JSON.stringify({
        funnel_id: step.funnel_id,
        step_id: step.id,
        step_name: step.step_name,
        step_number: step.step_number,
        step_type: step.step_type,
        funnel_name: funnel.name
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('Error in get-funnel-step:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
