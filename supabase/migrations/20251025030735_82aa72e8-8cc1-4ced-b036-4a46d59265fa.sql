-- Link conversations with NULL contact_id to correct contacts by phone number
UPDATE conversations conv
SET contact_id = c.id, updated_at = NOW()
FROM contacts c
WHERE conv.contact_id IS NULL
  AND (
    conv.phone_number = c.phone_number 
    OR conv.phone_number = '+1' || REPLACE(REPLACE(c.phone_number, '+1', ''), '-', '')
    OR REPLACE(REPLACE(conv.phone_number, '+1', ''), '-', '') = REPLACE(REPLACE(c.phone_number, '+1', ''), '-', '')
  );

-- Fix conversations incorrectly linked to contact #1581
-- Link them to Francis Kway if phone matches +17038630655
UPDATE conversations
SET contact_id = 'e1daabfd-5a02-4cca-a108-6de63af10a4f', updated_at = NOW()
WHERE phone_number = '+17038630655'
  AND (contact_id IS NULL OR contact_id != 'e1daabfd-5a02-4cca-a108-6de63af10a4f');