-- Fix existing contacts: Set lead_status based on customer_tier
-- Also ensure customer_tier is set properly

-- First, set customer_tier for contacts where it's NULL but we have data to infer it
UPDATE contacts
SET customer_tier = 'LEAD'
WHERE customer_tier IS NULL;

-- Set lead_status based on customer_tier for all contacts
UPDATE contacts
SET lead_status = CASE
  WHEN UPPER(customer_tier) = 'VIP' THEN 'hot'
  WHEN UPPER(customer_tier) LIKE '%LEVEL 3%' OR UPPER(customer_tier) = 'LEVEL 3' THEN 'hot'
  WHEN UPPER(customer_tier) LIKE '%LEVEL 2%' OR UPPER(customer_tier) = 'LEVEL 2' THEN 'warm'
  WHEN UPPER(customer_tier) LIKE '%LEVEL 1%' OR UPPER(customer_tier) = 'LEVEL 1' THEN 'warm'
  WHEN UPPER(customer_tier) = 'LEAD' THEN 'cold'
  WHEN UPPER(customer_tier) = 'SHITLIST' THEN 'cold'
  WHEN products_owned IS NOT NULL AND array_length(products_owned, 1) > 0 THEN 'customer'
  WHEN total_spent > 0 THEN 'customer'
  ELSE 'cold'
END
WHERE lead_status IS NULL OR lead_status = 'new';