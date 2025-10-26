import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const MONDAY_API_KEY = Deno.env.get('MONDAY_API_KEY');
    
    if (!MONDAY_API_KEY) {
      return new Response(
        JSON.stringify({ 
          error: 'Monday.com API key not configured',
          message: 'Please add MONDAY_API_KEY to your backend secrets to enable contact syncing.'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { boardIds } = await req.json();
    
    console.log('Syncing contacts from Monday.com...');

    const mondayApiUrl = 'https://api.monday.com/v2';
    const query = `
      query {
        boards(ids: [${boardIds?.join(',') || ''}]) {
          id
          name
          items_page(limit: 500) {
            items {
              id
              name
              column_values {
                id
                text
                value
              }
            }
          }
        }
      }
    `;

    const response = await fetch(mondayApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': MONDAY_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error(`Monday.com API error: ${response.status}`);
    }

    const result = await response.json();
    const boards = result.data?.boards || [];
    
    let syncedCount = 0;
    let updatedCount = 0;

    for (const board of boards) {
      const items = board.items_page?.items || [];
      
      for (const item of items) {
        // Extract column values
        const getColumnValue = (id: string) => {
          const col = item.column_values.find((c: any) => c.id === id);
          return col?.text || col?.value || null;
        };

        const phone = getColumnValue('phone') || getColumnValue('phone_number') || getColumnValue('mobile');
        const email = getColumnValue('email');
        const status = getColumnValue('status');
        const firstName = getColumnValue('first_name');
        const lastName = getColumnValue('last_name');

        // Parse products if they exist
        const productsText = getColumnValue('products_interested') || getColumnValue('products');
        const products = productsText ? productsText.split(',').map((p: string) => p.trim()) : [];

        const contactData = {
          monday_item_id: item.id,
          full_name: item.name,
          first_name: firstName,
          last_name: lastName,
          email: email,
          phone_number: phone,
          status: status,
          products_interested: products,
          monday_board_id: board.id,
          monday_board_name: board.name,
          synced_at: new Date().toISOString(),
          metadata: {
            raw_columns: item.column_values
          }
        };

        // Check for existing by monday_item_id, email, or phone (in that priority order)
        let existingContact = null;
        
        // First try monday_item_id
        const { data: mondayContact } = await supabase
          .from('contacts')
          .select('id')
          .eq('monday_item_id', item.id)
          .maybeSingle();
        
        if (mondayContact) {
          existingContact = mondayContact;
        } else if (email || phone) {
          // Try email or phone, prefer highest total_spent (VIP priority)
          const orCondition = [];
          if (email) orCondition.push(`email.eq.${email}`);
          if (phone) orCondition.push(`phone_number.eq.${phone}`);
          
          const { data: matchedContact } = await supabase
            .from('contacts')
            .select('id')
            .or(orCondition.join(','))
            .order('total_spent', { ascending: false, nullsFirst: false })
            .limit(1)
            .maybeSingle();
          
          if (matchedContact) {
            existingContact = matchedContact;
          }
        }

        if (existingContact) {
          await supabase
            .from('contacts')
            .update(contactData)
            .eq('id', existingContact.id);
          updatedCount++;
        } else {
          await supabase
            .from('contacts')
            .insert(contactData);
          syncedCount++;
        }
      }
    }

    console.log(`Synced ${syncedCount} new contacts, updated ${updatedCount} existing contacts`);

    return new Response(
      JSON.stringify({ 
        success: true,
        synced: syncedCount,
        updated: updatedCount,
        total: syncedCount + updatedCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Sync contacts error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
