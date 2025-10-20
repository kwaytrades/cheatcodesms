import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const mondayApiKey = Deno.env.get('MONDAY_API_KEY');
    if (!mondayApiKey) {
      throw new Error('MONDAY_API_KEY not configured');
    }

    const { contactIds } = await req.json();
    console.log('Syncing contacts to Monday:', contactIds);

    // Fetch contacts with monday_item_id
    const { data: contacts, error: fetchError } = await supabase
      .from('contacts')
      .select('*')
      .in('id', contactIds)
      .not('monday_item_id', 'is', null)
      .not('monday_board_id', 'is', null);

    if (fetchError) throw fetchError;

    console.log(`Found ${contacts?.length || 0} contacts with Monday IDs`);

    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    for (const contact of contacts || []) {
      try {
        // Prepare column values for Monday.com
        const columnValues: Record<string, any> = {};

        // Basic fields
        if (contact.status) {
          columnValues.status = { label: contact.status };
        }

        if (contact.email) {
          columnValues.email = { email: contact.email, text: contact.email };
        }

        if (contact.phone_number) {
          columnValues.phone = contact.phone_number;
        }

        if (contact.lead_score !== null) {
          columnValues.lead_score = contact.lead_score;
        }

        if (contact.engagement_score !== null) {
          columnValues.engagement_score = contact.engagement_score;
        }

        // AI Profile fields
        if (contact.ai_profile) {
          const aiProfile = contact.ai_profile as any;
          
          if (aiProfile.interests && Array.isArray(aiProfile.interests)) {
            columnValues.ai_interests = aiProfile.interests.join(', ');
          }

          if (aiProfile.complaints && Array.isArray(aiProfile.complaints)) {
            columnValues.ai_complaints = aiProfile.complaints.join('\n');
          }

          if (aiProfile.preferences) {
            columnValues.ai_preferences = JSON.stringify(aiProfile.preferences, null, 2);
          }

          if (aiProfile.important_notes && Array.isArray(aiProfile.important_notes)) {
            columnValues.ai_important_notes = aiProfile.important_notes.join('\n');
          }
        }

        // Customer Profile fields
        if (contact.customer_profile) {
          const customerProfile = contact.customer_profile as any;
          
          if (customerProfile.income_level) {
            columnValues.income_level = customerProfile.income_level;
          }

          if (customerProfile.interest_level) {
            columnValues.interest_level = customerProfile.interest_level;
          }
        }

        // Date fields
        if (contact.last_contact_date) {
          columnValues.last_contact_date = { date: contact.last_contact_date.split('T')[0] };
        }

        // Add AI last updated timestamp
        columnValues.ai_last_updated = { date: new Date().toISOString().split('T')[0] };

        // Update Monday.com item
        const mutation = `
          mutation ($boardId: ID!, $itemId: ID!, $columnValues: JSON!) {
            change_multiple_column_values(
              board_id: $boardId,
              item_id: $itemId,
              column_values: $columnValues
            ) {
              id
            }
          }
        `;

        const response = await fetch('https://api.monday.com/v2', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': mondayApiKey,
          },
          body: JSON.stringify({
            query: mutation,
            variables: {
              boardId: contact.monday_board_id,
              itemId: contact.monday_item_id,
              columnValues: JSON.stringify(columnValues),
            },
          }),
        });

        const result = await response.json();

        if (result.errors) {
          console.error('Monday API error for contact:', contact.full_name, result.errors);
          failCount++;
          errors.push(`${contact.full_name}: ${result.errors[0]?.message || 'Unknown error'}`);
        } else {
          console.log('Successfully synced contact to Monday:', contact.full_name);
          successCount++;

          // Update synced_at timestamp
          await supabase
            .from('contacts')
            .update({ synced_at: new Date().toISOString() })
            .eq('id', contact.id);
        }
      } catch (error: any) {
        console.error('Error syncing contact:', contact.full_name, error);
        failCount++;
        errors.push(`${contact.full_name}: ${error.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        successCount,
        failCount,
        total: contacts?.length || 0,
        errors: errors.slice(0, 5), // Return first 5 errors
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Sync to Monday error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
