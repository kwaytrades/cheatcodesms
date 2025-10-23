-- Remove any duplicate emails (keep the most recent one based on created_at)
DELETE FROM contacts a USING contacts b
WHERE a.id < b.id 
AND a.email IS NOT NULL 
AND b.email IS NOT NULL 
AND a.email = b.email;

-- Add unique constraint on email column
ALTER TABLE contacts ADD CONSTRAINT contacts_email_key UNIQUE (email);