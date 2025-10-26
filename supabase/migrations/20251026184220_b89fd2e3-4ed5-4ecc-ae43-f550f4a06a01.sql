-- Add last_purchase_date column to contacts table
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS last_purchase_date TIMESTAMPTZ;

COMMENT ON COLUMN contacts.last_purchase_date IS 'Date of most recent purchase - used to calculate purchase recency penalty (prevents immediate re-targeting after purchase)';

-- Create function to update last_purchase_date when a purchase is made
CREATE OR REPLACE FUNCTION update_contact_last_purchase_date()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE contacts
  SET 
    last_purchase_date = NEW.purchase_date,
    updated_at = NOW()
  WHERE id = NEW.contact_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to automatically update last_purchase_date on new purchases
DROP TRIGGER IF EXISTS on_purchase_update_last_purchase_date ON purchases;
CREATE TRIGGER on_purchase_update_last_purchase_date
  AFTER INSERT ON purchases
  FOR EACH ROW
  EXECUTE FUNCTION update_contact_last_purchase_date();