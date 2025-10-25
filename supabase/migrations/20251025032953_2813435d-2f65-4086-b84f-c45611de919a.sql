-- Backfill missing contact_id in conversations table by matching normalized phone numbers
-- This ensures all conversations are properly linked to their contacts for AI agent context

-- Create a temporary function to normalize phone numbers (strips +1 and formatting)
CREATE OR REPLACE FUNCTION normalize_phone_temp(phone TEXT) RETURNS TEXT AS $$
BEGIN
  -- Remove all spaces, dashes, parentheses, and dots
  phone := regexp_replace(phone, '[\s\-\(\)\.]', '', 'g');
  
  -- Strip +1 prefix if present
  IF phone LIKE '+1%' THEN
    phone := substring(phone from 3);
  -- Handle case where it's just '1' prefix without '+' (and length is 11)
  ELSIF phone LIKE '1%' AND length(phone) = 11 THEN
    phone := substring(phone from 2);
  END IF;
  
  RETURN phone;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update all conversations with NULL contact_id by matching normalized phone numbers
UPDATE conversations conv
SET contact_id = c.id,
    contact_name = c.full_name,
    updated_at = NOW()
FROM contacts c
WHERE conv.contact_id IS NULL
  AND c.phone_number IS NOT NULL
  AND normalize_phone_temp(conv.phone_number) = normalize_phone_temp(c.phone_number);

-- Also fix any mismatched contact_id where the phone numbers should match
UPDATE conversations conv
SET contact_id = c.id,
    contact_name = c.full_name,
    updated_at = NOW()
FROM contacts c
WHERE conv.contact_id != c.id
  AND c.phone_number IS NOT NULL
  AND normalize_phone_temp(conv.phone_number) = normalize_phone_temp(c.phone_number);

-- Drop the temporary function
DROP FUNCTION IF EXISTS normalize_phone_temp(TEXT);

-- Log the results
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM conversations
  WHERE contact_id IS NOT NULL;
  
  RAISE NOTICE '✅ Backfill complete. Total conversations with contact_id: %', updated_count;
END $$;