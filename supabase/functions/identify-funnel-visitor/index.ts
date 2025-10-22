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

    const { session_id, email, phone, name, funnel_id } = await req.json();
    console.log('Identifying visitor:', { session_id, email, phone });

    if (!session_id || (!email && !phone)) {
      return new Response(
        JSON.stringify({ error: 'session_id and (email or phone) required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find or create contact
    let { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('*')
      .or(email ? `email.eq.${email}` : `phone_number.eq.${phone}`)
      .maybeSingle();

    if (!contact) {
      // Create new contact
      const contactData: any = {
        full_name: name || 'Unknown',
        lead_status: 'new',
      };
      
      if (email) contactData.email = email;
      if (phone) contactData.phone_number = phone;

      const { data: newContact, error: createError } = await supabase
        .from('contacts')
        .insert(contactData)
        .select()
        .single();

      if (createError) {
        console.error('Error creating contact:', createError);
        throw createError;
      }
      contact = newContact;
      console.log('Created new contact:', contact.id);
    } else {
      console.log('Found existing contact:', contact.id);
    }

    // Update all visits with this session to link to contact
    const { error: updateVisitsError } = await supabase
      .from('funnel_visits')
      .update({ contact_id: contact.id })
      .eq('session_id', session_id);

    if (updateVisitsError) {
      console.error('Error updating visits:', updateVisitsError);
    }

    // Update all events with this session to link to contact
    const { data: visits } = await supabase
      .from('funnel_visits')
      .select('id')
      .eq('session_id', session_id);

    if (visits && visits.length > 0) {
      const visitIds = visits.map(v => v.id);
      const { error: updateEventsError } = await supabase
        .from('funnel_step_events')
        .update({ contact_id: contact.id })
        .in('visit_id', visitIds);

      if (updateEventsError) {
        console.error('Error updating events:', updateEventsError);
      }
    }

    // Update contact UTM params from visit if available
    if (funnel_id) {
      const { data: visit } = await supabase
        .from('funnel_visits')
        .select('*')
        .eq('session_id', session_id)
        .eq('funnel_id', funnel_id)
        .maybeSingle();

      if (visit && (visit.utm_source || visit.utm_campaign)) {
        await supabase
          .from('contacts')
          .update({
            utm_campaign: visit.utm_campaign,
            lead_source: visit.utm_source,
            referrer: visit.referrer,
          })
          .eq('id', contact.id);
      }
    }

    console.log('Visitor identified successfully');
    return new Response(
      JSON.stringify({ success: true, contact_id: contact.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in identify-funnel-visitor:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
