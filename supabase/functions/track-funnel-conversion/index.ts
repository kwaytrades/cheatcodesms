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

    const { 
      session_id, 
      funnel_id, 
      contact_id, 
      conversion_type, 
      order_value, 
      product_id,
      product_name 
    } = await req.json();
    
    console.log('Recording conversion:', { session_id, funnel_id, contact_id, order_value });

    if (!session_id || !funnel_id || !contact_id || !order_value) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find the visit
    const { data: visit, error: visitError } = await supabase
      .from('funnel_visits')
      .select('*')
      .eq('session_id', session_id)
      .eq('funnel_id', funnel_id)
      .maybeSingle();

    if (!visit) {
      console.error('Visit not found');
      return new Response(
        JSON.stringify({ error: 'Visit not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark visit as completed
    await supabase
      .from('funnel_visits')
      .update({ 
        completed: true, 
        total_value: order_value,
        contact_id: contact_id
      })
      .eq('id', visit.id);

    // Record the conversion
    const { error: conversionError } = await supabase
      .from('funnel_conversions')
      .insert({
        visit_id: visit.id,
        funnel_id,
        contact_id,
        conversion_type: conversion_type || 'main_offer',
        product_id: product_id || null,
        order_value,
      });

    if (conversionError) {
      console.error('Error creating conversion:', conversionError);
      throw conversionError;
    }

    // Update contact data
    const { data: contact } = await supabase
      .from('contacts')
      .select('total_spent, products_owned')
      .eq('id', contact_id)
      .single();

    if (contact) {
      const newTotalSpent = (parseFloat(contact.total_spent) || 0) + parseFloat(order_value);
      const productsOwned = contact.products_owned || [];
      
      if (product_name && !productsOwned.includes(product_name)) {
        productsOwned.push(product_name);
      }

      await supabase
        .from('contacts')
        .update({
          total_spent: newTotalSpent,
          products_owned: productsOwned,
          lead_status: 'customer',
          last_contact_date: new Date().toISOString(),
        })
        .eq('id', contact_id);
    }

    // Record purchase in purchases table
    if (product_id) {
      await supabase
        .from('purchases')
        .insert({
          contact_id,
          product_id,
          amount: order_value,
          status: 'completed',
        });
    }

    // Create contact activity
    await supabase
      .from('contact_activities')
      .insert({
        contact_id,
        activity_type: 'purchase',
        description: `Completed ${conversion_type} purchase via funnel`,
        metadata: {
          funnel_id,
          order_value,
          product_id,
          product_name,
        },
      });

    console.log('Conversion recorded successfully');
    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in track-funnel-conversion:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
