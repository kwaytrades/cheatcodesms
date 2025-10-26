-- Create function to get/build unified customer profile with 5-minute cache
CREATE OR REPLACE FUNCTION get_customer_profile(p_contact_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
SET search_path = 'public'
AS $$
DECLARE
  v_profile JSONB;
  v_contact RECORD;
  v_last_updated TIMESTAMP;
BEGIN
  -- Fetch contact data
  SELECT * INTO v_contact
  FROM contacts
  WHERE id = p_contact_id;
  
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  
  -- Check if cached profile exists and is recent (< 5 minutes old)
  IF v_contact.customer_profile IS NOT NULL THEN
    v_last_updated := (v_contact.customer_profile->'insights'->>'lastUpdated')::TIMESTAMP;
    IF v_last_updated IS NOT NULL AND v_last_updated > NOW() - INTERVAL '5 minutes' THEN
      RETURN v_contact.customer_profile;
    END IF;
  END IF;
  
  -- Build/refresh profile
  v_profile := jsonb_build_object(
    'identity', jsonb_build_object(
      'name', v_contact.full_name,
      'email', v_contact.email,
      'phone', v_contact.phone_number
    ),
    'financial', jsonb_build_object(
      'tier', COALESCE(v_contact.customer_tier, 'Lead'),
      'totalSpent', COALESCE(v_contact.total_spent, 0),
      'productsOwned', COALESCE(v_contact.products_owned, ARRAY[]::text[]),
      'productsCount', COALESCE(array_length(v_contact.products_owned, 1), 0),
      'hasDisputed', COALESCE(v_contact.has_disputed, false),
      'disputedAmount', COALESCE(v_contact.disputed_amount, 0)
    ),
    'engagement', jsonb_build_object(
      'leadScore', COALESCE(v_contact.lead_score, 0),
      'engagementScore', COALESCE(v_contact.engagement_score, 0),
      'likelihoodScore', COALESCE(v_contact.likelihood_to_buy_score, 0),
      'sentiment', v_contact.sentiment,
      'lastEngagement', v_contact.last_engagement_date
    ),
    'trading', jsonb_build_object(
      'experience', v_contact.trading_experience,
      'style', v_contact.trading_style,
      'accountSize', v_contact.account_size,
      'riskTolerance', v_contact.risk_tolerance,
      'interests', COALESCE(v_contact.products_interested, ARRAY[]::text[]),
      'goals', COALESCE(v_contact.goals, ARRAY[]::text[]),
      'sectors', COALESCE(v_contact.sectors_of_interest, ARRAY[]::text[])
    ),
    'behavioral', jsonb_build_object(
      'personalityType', v_contact.personality_type,
      'tags', COALESCE(v_contact.behavioral_tags, ARRAY[]::text[]),
      'regularTags', COALESCE(v_contact.tags, ARRAY[]::text[]),
      'communicationStyle', COALESCE(v_contact.ai_profile->>'communication_style', 'Not analyzed'),
      'objections', v_contact.objections
    ),
    'insights', jsonb_build_object(
      'summary', COALESCE(v_contact.ai_profile->>'summary', 'No AI summary available'),
      'lastUpdated', NOW()
    )
  );
  
  -- Cache the profile back to the contacts table
  UPDATE contacts
  SET customer_profile = v_profile
  WHERE id = p_contact_id;
  
  RETURN v_profile;
END;
$$;

-- Create function to invalidate profile cache
CREATE OR REPLACE FUNCTION refresh_customer_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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

-- Create trigger to auto-refresh profile when key data changes
DROP TRIGGER IF EXISTS refresh_profile_on_update ON contacts;
CREATE TRIGGER refresh_profile_on_update
BEFORE UPDATE OF products_owned, customer_tier, total_spent, engagement_score, lead_score, likelihood_to_buy_score
ON contacts
FOR EACH ROW
EXECUTE FUNCTION refresh_customer_profile();