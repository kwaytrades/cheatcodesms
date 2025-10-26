-- Fix security warning: Set search_path for auto_normalize_phone trigger function
DROP TRIGGER IF EXISTS normalize_contact_phone ON contacts;
DROP FUNCTION IF EXISTS auto_normalize_phone();

CREATE OR REPLACE FUNCTION auto_normalize_phone()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.phone_number IS NOT NULL THEN
    NEW.phone_number := normalize_phone(NEW.phone_number);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER normalize_contact_phone
BEFORE INSERT OR UPDATE ON contacts
FOR EACH ROW
EXECUTE FUNCTION auto_normalize_phone();