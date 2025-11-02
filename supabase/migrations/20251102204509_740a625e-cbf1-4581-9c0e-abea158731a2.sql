-- Create helper function to find duplicate phone numbers using normalization
CREATE OR REPLACE FUNCTION find_duplicate_phone(input_phone text)
RETURNS TABLE (
  id uuid,
  full_name text,
  phone_number text
) AS $$
BEGIN
  RETURN QUERY
  SELECT c.id, c.full_name, c.phone_number
  FROM contacts c
  WHERE normalize_phone(c.phone_number) = normalize_phone(input_phone)
  AND c.phone_number IS NOT NULL
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;