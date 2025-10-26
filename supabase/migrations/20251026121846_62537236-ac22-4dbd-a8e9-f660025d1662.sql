-- Step 1: Create phone normalization function
CREATE OR REPLACE FUNCTION normalize_phone(phone TEXT) 
RETURNS TEXT AS $$
BEGIN
  IF phone IS NULL THEN RETURN NULL; END IF;
  
  -- Remove all spaces, dashes, parentheses, and dots
  phone := regexp_replace(phone, '[\s\-\(\)\.]', '', 'g');
  
  -- Strip +1 prefix if present
  IF phone LIKE '+1%' THEN
    phone := substring(phone from 3);
  ELSIF phone LIKE '1%' AND length(phone) = 11 THEN
    phone := substring(phone from 2);
  END IF;
  
  RETURN phone;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Step 2: Normalize all existing phone numbers
UPDATE contacts
SET phone_number = normalize_phone(phone_number)
WHERE phone_number IS NOT NULL;

-- Step 3: Merge duplicate contacts before adding unique constraint
DO $$
DECLARE
  duplicate_phone TEXT;
  primary_contact_id UUID;
  duplicate_ids UUID[];
  merged_products TEXT[];
  total_spending NUMERIC;
BEGIN
  -- Loop through each set of duplicate normalized phone numbers
  FOR duplicate_phone IN 
    SELECT normalize_phone(phone_number) 
    FROM contacts 
    WHERE phone_number IS NOT NULL
    GROUP BY normalize_phone(phone_number)
    HAVING COUNT(*) > 1
  LOOP
    -- Find the primary contact (highest total_spent, then earliest created)
    SELECT id INTO primary_contact_id
    FROM contacts
    WHERE normalize_phone(phone_number) = duplicate_phone
    ORDER BY total_spent DESC NULLS LAST, created_at ASC
    LIMIT 1;
    
    -- Get all duplicate IDs except primary
    SELECT array_agg(id) INTO duplicate_ids
    FROM contacts
    WHERE normalize_phone(phone_number) = duplicate_phone
      AND id != primary_contact_id;
    
    -- Merge products_owned (deduplicate)
    SELECT array_agg(DISTINCT product) INTO merged_products
    FROM (
      SELECT unnest(products_owned) as product
      FROM contacts
      WHERE normalize_phone(phone_number) = duplicate_phone
    ) subq;
    
    -- Calculate total spending across all duplicates
    SELECT COALESCE(SUM(total_spent), 0) INTO total_spending
    FROM contacts
    WHERE normalize_phone(phone_number) = duplicate_phone;
    
    -- Update primary contact with merged data
    UPDATE contacts
    SET 
      products_owned = merged_products,
      total_spent = total_spending,
      -- Keep best values from any duplicate
      email = COALESCE(email, (SELECT email FROM contacts WHERE id = ANY(duplicate_ids) AND email IS NOT NULL LIMIT 1)),
      full_name = COALESCE(full_name, (SELECT full_name FROM contacts WHERE id = ANY(duplicate_ids) LIMIT 1)),
      customer_tier = (
        SELECT customer_tier 
        FROM contacts 
        WHERE normalize_phone(phone_number) = duplicate_phone
        ORDER BY 
          CASE customer_tier
            WHEN 'vip' THEN 1
            WHEN 'high-value' THEN 2
            WHEN 'mid-value' THEN 3
            WHEN 'low-value' THEN 4
            ELSE 5
          END
        LIMIT 1
      ),
      updated_at = NOW()
    WHERE id = primary_contact_id;
    
    -- Reassign conversations to primary contact
    UPDATE conversations SET contact_id = primary_contact_id WHERE contact_id = ANY(duplicate_ids);
    
    -- Reassign other related records
    UPDATE contact_activities SET contact_id = primary_contact_id WHERE contact_id = ANY(duplicate_ids);
    UPDATE funnel_visits SET contact_id = primary_contact_id WHERE contact_id = ANY(duplicate_ids);
    UPDATE funnel_step_events SET contact_id = primary_contact_id WHERE contact_id = ANY(duplicate_ids);
    UPDATE product_agents SET contact_id = primary_contact_id WHERE contact_id = ANY(duplicate_ids);
    
    -- Handle conversation_state specially (has unique constraint on contact_id)
    -- Delete duplicate conversation states, keep only the primary's
    DELETE FROM conversation_state WHERE contact_id = ANY(duplicate_ids);
    
    -- If primary doesn't have conversation_state, create one
    INSERT INTO conversation_state (contact_id, created_at, updated_at)
    VALUES (primary_contact_id, NOW(), NOW())
    ON CONFLICT (contact_id) DO NOTHING;
    
    -- Delete duplicate contacts
    DELETE FROM contacts WHERE id = ANY(duplicate_ids);
    
    RAISE NOTICE 'Merged % duplicates for phone: % into primary contact: %', array_length(duplicate_ids, 1), duplicate_phone, primary_contact_id;
  END LOOP;
END $$;

-- Step 4: Add unique constraint (now safe since duplicates are merged)
CREATE UNIQUE INDEX idx_contacts_normalized_phone 
ON contacts (normalize_phone(phone_number))
WHERE phone_number IS NOT NULL;

-- Step 5: Create auto-normalization trigger for future inserts/updates
CREATE OR REPLACE FUNCTION auto_normalize_phone()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.phone_number IS NOT NULL THEN
    NEW.phone_number := normalize_phone(NEW.phone_number);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER normalize_contact_phone
BEFORE INSERT OR UPDATE ON contacts
FOR EACH ROW
EXECUTE FUNCTION auto_normalize_phone();

-- Step 6: Create find_or_create_contact helper function
CREATE OR REPLACE FUNCTION find_or_create_contact(
  p_email TEXT,
  p_phone TEXT,
  p_name TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID AS $$
DECLARE
  v_contact_id UUID;
  v_normalized_phone TEXT;
BEGIN
  v_normalized_phone := normalize_phone(p_phone);
  
  -- Try to find existing contact by email OR phone
  -- Prefer contact with higher total_spent (VIP customers take priority)
  SELECT id INTO v_contact_id
  FROM contacts
  WHERE (p_email IS NOT NULL AND email = p_email) 
     OR (v_normalized_phone IS NOT NULL AND phone_number = v_normalized_phone)
  ORDER BY total_spent DESC NULLS LAST, created_at ASC
  LIMIT 1;
  
  -- If no existing contact found, create new one
  IF v_contact_id IS NULL THEN
    INSERT INTO contacts (email, phone_number, full_name, metadata, lead_status)
    VALUES (p_email, v_normalized_phone, p_name, p_metadata, 'new')
    RETURNING id INTO v_contact_id;
  END IF;
  
  RETURN v_contact_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;