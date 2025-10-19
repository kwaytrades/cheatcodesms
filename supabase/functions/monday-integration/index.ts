import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, phone, data } = await req.json();
    
    const MONDAY_API_KEY = Deno.env.get('MONDAY_API_KEY');
    if (!MONDAY_API_KEY) {
      throw new Error('MONDAY_API_KEY not configured. Please add it in the backend secrets.');
    }

    const mondayApiUrl = 'https://api.monday.com/v2';

    switch (action) {
      case 'list_boards': {
        // List all available boards
        const query = `
          query {
            boards(limit: 100) {
              id
              name
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
        
        return new Response(
          JSON.stringify({ boards: result.data?.boards || [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'search_contact': {
        // Search for contact by phone number
        const query = `
          query {
            boards(limit: 50) {
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

        const result = await response.json();
        
        // Filter items to find contact with matching phone
        let foundContact = null;
        if (result.data?.boards) {
          for (const board of result.data.boards) {
            if (!board.items_page?.items) continue;
            
            for (const item of board.items_page.items) {
              const phoneColumn = item.column_values.find((col: any) => 
                col.text && col.text.includes(phone)
              );
              
              if (phoneColumn) {
                foundContact = {
                  id: item.id,
                  name: item.name,
                  columns: item.column_values,
                };
                break;
              }
            }
            
            if (foundContact) break;
          }
        }

        return new Response(
          JSON.stringify({ contact: foundContact }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'create_lead': {
        // Create new lead in Monday.com
        const mutation = `
          mutation {
            create_item (
              board_id: YOUR_BOARD_ID,
              item_name: "${data.name || data.phone}",
              column_values: "{\\"phone\\":\\"${data.phone}\\",\\"source\\":\\"SMS\\"}"
            ) {
              id
            }
          }
        `;

        const response = await fetch(mondayApiUrl, {
          method: 'POST',
          headers: {
            'Authorization': MONDAY_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: mutation }),
        });

        const result = await response.json();

        return new Response(
          JSON.stringify({ contact: result.data?.create_item }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'fetch_contacts': {
        // Fetch contacts with filters for campaigns
        const { boardId, filters } = data;
        
        const query = `
          query {
            boards(ids: [${boardId}]) {
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

        const result = await response.json();
        const contacts = result.data?.boards[0]?.items_page?.items || [];

        return new Response(
          JSON.stringify({ contacts }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update_contact': {
        // Update contact fields
        const { itemId, columnValues } = data;
        
        const mutation = `
          mutation {
            change_multiple_column_values (
              item_id: ${itemId},
              board_id: YOUR_BOARD_ID,
              column_values: ${JSON.stringify(JSON.stringify(columnValues))}
            ) {
              id
            }
          }
        `;

        const response = await fetch(mondayApiUrl, {
          method: 'POST',
          headers: {
            'Authorization': MONDAY_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: mutation }),
        });

        const result = await response.json();

        return new Response(
          JSON.stringify({ success: true, data: result.data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

  } catch (error) {
    console.error('Monday.com integration error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
