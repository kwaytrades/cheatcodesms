-- Universal contact linking for conversations by phone AND email
-- First, link by phone number
UPDATE conversations conv
SET contact_id = c.id, updated_at = NOW()
FROM contacts c
WHERE conv.contact_id IS NULL
  AND c.phone_number IS NOT NULL
  AND (
    conv.phone_number = c.phone_number 
    OR conv.phone_number = '+1' || REPLACE(REPLACE(c.phone_number, '+1', ''), '-', '')
    OR REPLACE(REPLACE(conv.phone_number, '+1', ''), '-', '') = REPLACE(REPLACE(c.phone_number, '+1', ''), '-', '')
  );

-- Then, fix any conversations that have contact_id but it doesn't match the phone
-- (This handles cases where conversation was linked to wrong contact)
UPDATE conversations conv
SET contact_id = c.id, updated_at = NOW()
FROM contacts c
WHERE conv.contact_id IS NOT NULL
  AND c.phone_number IS NOT NULL
  AND conv.phone_number IS NOT NULL
  AND (
    conv.phone_number = c.phone_number 
    OR conv.phone_number = '+1' || REPLACE(REPLACE(c.phone_number, '+1', ''), '-', '')
    OR REPLACE(REPLACE(conv.phone_number, '+1', ''), '-', '') = REPLACE(REPLACE(c.phone_number, '+1', ''), '-', '')
  )
  AND conv.contact_id != c.id;