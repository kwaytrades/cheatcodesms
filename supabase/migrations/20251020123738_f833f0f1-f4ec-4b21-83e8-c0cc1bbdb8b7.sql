-- Fix security warnings: Add search_path to functions

-- Update calculate_lead_score function
CREATE OR REPLACE FUNCTION calculate_lead_score(p_contact_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_score INTEGER := 0;
  v_email_opens INTEGER;
  v_sms_replies INTEGER;
  v_purchases INTEGER;
BEGIN
  -- Count email opens (weight: 20 points max)
  SELECT COUNT(*) INTO v_email_opens
  FROM contact_activities
  WHERE contact_id = p_contact_id AND activity_type = 'email_open'
  AND created_at > NOW() - INTERVAL '30 days';
  v_score := v_score + LEAST(v_email_opens * 2, 20);
  
  -- Count SMS replies (weight: 25 points max)
  SELECT COUNT(*) INTO v_sms_replies
  FROM contact_activities
  WHERE contact_id = p_contact_id AND activity_type = 'sms_reply'
  AND created_at > NOW() - INTERVAL '30 days';
  v_score := v_score + LEAST(v_sms_replies * 5, 25);
  
  -- Count purchases (weight: 30 points max)
  SELECT COUNT(*) INTO v_purchases
  FROM purchases
  WHERE contact_id = p_contact_id AND status = 'completed';
  v_score := v_score + LEAST(v_purchases * 15, 30);
  
  -- Cap at 100
  RETURN LEAST(v_score, 100);
END;
$$;

-- Update get_customer_context function
CREATE OR REPLACE FUNCTION get_customer_context(p_contact_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_context JSONB;
BEGIN
  SELECT jsonb_build_object(
    'contact', row_to_json(c.*),
    'purchases', COALESCE(
      (SELECT jsonb_agg(row_to_json(p.*))
       FROM purchases p
       WHERE p.contact_id = c.id
       ORDER BY p.purchase_date DESC),
      '[]'::jsonb
    ),
    'recent_activities', COALESCE(
      (SELECT jsonb_agg(row_to_json(a.*))
       FROM contact_activities a
       WHERE a.contact_id = c.id
       ORDER BY a.created_at DESC
       LIMIT 10),
      '[]'::jsonb
    ),
    'previous_ai_messages', COALESCE(
      (SELECT jsonb_agg(row_to_json(m.*))
       FROM ai_messages m
       WHERE m.contact_id = c.id
       ORDER BY m.sent_at DESC
       LIMIT 5),
      '[]'::jsonb
    )
  ) INTO v_context
  FROM contacts c
  WHERE c.id = p_contact_id;
  
  RETURN v_context;
END;
$$;

-- Update update_updated_at_column function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;