import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function enrichNameFromEmail(
  email: string, 
  existingFirstName?: string, 
  existingLastName?: string
): { firstName: string; lastName: string } {
  // ONLY enrich if BOTH first_name AND last_name are empty
  if (existingFirstName || existingLastName) {
    return { 
      firstName: existingFirstName || '', 
      lastName: existingLastName || '' 
    };
  }

  const username = email.split('@')[0].toLowerCase();

  // Pattern 1: firstname.lastname93837
  const dotPattern = /^([a-z]+)\.([a-z]+)\d*$/;
  if (dotPattern.test(username)) {
    const match = username.match(dotPattern);
    if (match) {
      return {
        firstName: capitalize(match[1]),
        lastName: capitalize(match[2])
      };
    }
  }

  // Pattern 2: firstnamelastname (common names only)
  const commonFirstNames = [
    'john', 'joe', 'james', 'michael', 'david', 'robert', 'mary', 
    'jennifer', 'linda', 'william', 'thomas', 'charles', 'daniel',
    'matthew', 'christopher', 'anthony', 'mark', 'donald', 'steven',
    'paul', 'andrew', 'joshua', 'kenneth', 'kevin', 'brian', 'george',
    'sarah', 'nancy', 'lisa', 'betty', 'margaret', 'sandra', 'ashley',
    'emily', 'elizabeth', 'jessica', 'amanda', 'melissa', 'laura'
  ];

  for (const name of commonFirstNames) {
    if (username.startsWith(name) && username.length > name.length + 2) {
      const remainder = username.substring(name.length).replace(/\d+$/, '');
      if (remainder.length >= 3) {
        return {
          firstName: capitalize(name),
          lastName: capitalize(remainder)
        };
      }
    }
  }

  // Pattern 3: j.smith2024 (initial + lastname)
  const initialPattern = /^([a-z])([a-z]{3,})\d*$/;
  if (initialPattern.test(username)) {
    const match = username.match(initialPattern);
    if (match) {
      return {
        firstName: match[1].toUpperCase() + '.',
        lastName: capitalize(match[2])
      };
    }
  }

  // Pattern 4: Single word name (4-12 chars, no numbers)
  const singleNamePattern = /^[a-z]{4,12}$/;
  if (singleNamePattern.test(username)) {
    return {
      firstName: capitalize(username),
      lastName: ''
    };
  }

  // No pattern matched - leave empty
  return { firstName: '', lastName: '' };
}

function enrichAddress(existingAddress: any, newAddress: any): any {
  return {
    address_line1: newAddress.address_line1 || existingAddress.address_line1 || null,
    address_line2: newAddress.address_line2 || existingAddress.address_line2 || null,
    city: newAddress.city || existingAddress.city || null,
    state: newAddress.state || existingAddress.state || null,
    postal_code: newAddress.postal_code || existingAddress.postal_code || null,
    country: newAddress.country || existingAddress.country || null
  };
}

function cleanData(data: any): any {
  const cleaned: any = {};

  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) {
      cleaned[key] = null;
      continue;
    }

    if (typeof value === 'string') {
      // Trim whitespace
      cleaned[key] = value.trim();

      // Normalize email
      if (key === 'email') {
        cleaned[key] = value.toLowerCase().trim();
      }
    } else if (Array.isArray(value)) {
      // Remove duplicates from arrays
      cleaned[key] = [...new Set(value)];
    } else {
      cleaned[key] = value;
    }
  }

  return cleaned;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, existing_data = {}, import_data = {} } = await req.json();

    // Clean all data first
    const cleanExisting = cleanData(existing_data);
    const cleanImport = cleanData(import_data);

    // Enrich name from email (only if both names are empty)
    const enrichedNames = enrichNameFromEmail(
      email,
      cleanExisting.first_name || cleanImport.first_name,
      cleanExisting.last_name || cleanImport.last_name
    );

    // Enrich address (don't overwrite existing)
    const enrichedAddress = enrichAddress(
      {
        address_line1: cleanExisting.address_line1,
        address_line2: cleanExisting.address_line2,
        city: cleanExisting.city,
        state: cleanExisting.state,
        postal_code: cleanExisting.postal_code,
        country: cleanExisting.country
      },
      {
        address_line1: cleanImport.address_line1,
        address_line2: cleanImport.address_line2,
        city: cleanImport.city,
        state: cleanImport.state,
        postal_code: cleanImport.postal_code,
        country: cleanImport.country
      }
    );

    // Build enriched contact
    const enrichedContact = {
      email: cleanImport.email || email,
      first_name: enrichedNames.firstName || cleanImport.first_name || cleanExisting.first_name || '',
      last_name: enrichedNames.lastName || cleanImport.last_name || cleanExisting.last_name || '',
      full_name: '', // Will be constructed
      phone_number: cleanImport.phone_number || cleanExisting.phone_number || null,
      ...enrichedAddress,
      tags: cleanImport.tags || cleanExisting.tags || [],
      products_owned: cleanImport.products_owned || cleanExisting.products_owned || [],
      metadata: { ...cleanExisting.metadata, ...cleanImport.metadata }
    };

    // Construct full_name
    enrichedContact.full_name = [enrichedContact.first_name, enrichedContact.last_name]
      .filter(Boolean)
      .join(' ') || enrichedContact.email.split('@')[0];

    console.log('Contact enriched:', { 
      email: enrichedContact.email, 
      name: enrichedContact.full_name 
    });

    return new Response(JSON.stringify({ enriched_contact: enrichedContact }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error enriching contact:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
