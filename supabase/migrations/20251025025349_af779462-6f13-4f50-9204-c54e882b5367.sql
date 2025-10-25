-- Backfill missing contact_id links in conversations table
-- Link conversations to contacts based on matching phone numbers

UPDATE conversations c
SET contact_id = ct.id,
    updated_at = NOW()
FROM contacts ct
WHERE c.contact_id IS NULL
  AND ct.phone_number IS NOT NULL
  AND (
    c.phone_number = ct.phone_number 
    OR c.phone_number = '+1' || ct.phone_number
    OR '+1' || c.phone_number = ct.phone_number
    OR REGEXP_REPLACE(c.phone_number, '[^0-9]', '', 'g') = REGEXP_REPLACE(ct.phone_number, '[^0-9]', '', 'g')
  );