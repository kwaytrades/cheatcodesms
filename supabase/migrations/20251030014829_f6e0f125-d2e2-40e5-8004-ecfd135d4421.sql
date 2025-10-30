-- First, drop the trigger that depends on lead_score
DROP TRIGGER IF EXISTS refresh_profile_on_update ON contacts;

-- Remove obsolete lead_score and engagement_score columns
ALTER TABLE contacts DROP COLUMN IF EXISTS lead_score CASCADE;
ALTER TABLE contacts DROP COLUMN IF EXISTS engagement_score CASCADE;

-- Recreate the profile refresh trigger without the dropped columns
CREATE OR REPLACE FUNCTION refresh_customer_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Invalidate cache by setting lastUpdated to past
  IF NEW.customer_profile IS NOT NULL THEN
    NEW.customer_profile := jsonb_set(
      NEW.customer_profile,
      '{insights,lastUpdated}',
      to_jsonb(NOW() - INTERVAL '1 hour')
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER refresh_profile_on_update
  BEFORE UPDATE ON contacts
  FOR EACH ROW
  WHEN (
    OLD.likelihood_to_buy_score IS DISTINCT FROM NEW.likelihood_to_buy_score OR
    OLD.total_spent IS DISTINCT FROM NEW.total_spent OR
    OLD.customer_tier IS DISTINCT FROM NEW.customer_tier OR
    OLD.products_owned IS DISTINCT FROM NEW.products_owned
  )
  EXECUTE FUNCTION refresh_customer_profile();

-- Ensure last_purchase_date is updated automatically
CREATE OR REPLACE FUNCTION update_contact_last_purchase_date()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE contacts
  SET 
    last_purchase_date = NEW.purchase_date,
    updated_at = NOW()
  WHERE id = NEW.contact_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_contact_last_purchase_date ON purchases;

CREATE TRIGGER trigger_update_contact_last_purchase_date
AFTER INSERT OR UPDATE ON purchases
FOR EACH ROW
EXECUTE FUNCTION update_contact_last_purchase_date();