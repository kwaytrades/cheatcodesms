import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const eventData = await req.json();
    console.log('Received funnel event:', eventData);

    const {
      funnel_id,
      step_id,
      session_id,
      event_type,
      utm_params,
      referrer,
      device_info,
      duration,
      metadata,
      contact_id
    } = eventData;

    console.log('Tracking event:', { funnel_id, step_id, session_id, event_type });

    // Find or create visit
    let { data: visit, error: visitError } = await supabase
      .from('funnel_visits')
      .select('*')
      .eq('session_id', session_id)
      .eq('funnel_id', funnel_id)
      .maybeSingle();

    if (!visit) {
      // Create new visit
      const { data: newVisit, error: createError } = await supabase
        .from('funnel_visits')
        .insert({
          funnel_id,
          session_id,
          contact_id: contact_id || null,
          entry_step_id: step_id,
          current_step_id: step_id,
          utm_source: utm_params?.utm_source,
          utm_medium: utm_params?.utm_medium,
          utm_campaign: utm_params?.utm_campaign,
          utm_content: utm_params?.utm_content,
          utm_term: utm_params?.utm_term,
          referrer,
          device_type: device_info?.device_type,
          browser: device_info?.browser,
          ip_address: req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip'),
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating visit:', createError);
        throw createError;
      }
      visit = newVisit;
    } else {
      // Update existing visit
      await supabase
        .from('funnel_visits')
        .update({
          current_step_id: step_id,
          last_activity_at: new Date().toISOString(),
          contact_id: contact_id || visit.contact_id,
        })
        .eq('id', visit.id);
    }

    // Record the step event
    const { error: eventError } = await supabase
      .from('funnel_step_events')
      .insert({
        visit_id: visit.id,
        step_id: step_id,
        contact_id: contact_id || null,
        event_type: event_type || 'page_view',
        duration_seconds: duration,
        metadata: metadata || {},
      });

    if (eventError) {
      console.error('Error creating event:', eventError);
      throw eventError;
    }

    console.log('Event tracked successfully');
    return new Response(
      JSON.stringify({ success: true, visit_id: visit.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in track-funnel-event:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
