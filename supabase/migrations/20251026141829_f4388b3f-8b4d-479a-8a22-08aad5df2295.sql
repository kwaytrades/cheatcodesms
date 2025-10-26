-- Step 1: Create auto-sync trigger for customer_profile
CREATE OR REPLACE FUNCTION auto_refresh_customer_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.customer_profile := jsonb_build_object(
    'identity', jsonb_build_object(
      'name', NEW.full_name,
      'email', NEW.email,
      'phone', NEW.phone_number
    ),
    'financial', jsonb_build_object(
      'tier', COALESCE(NEW.customer_tier, 'Lead'),
      'totalSpent', COALESCE(NEW.total_spent, 0),
      'productsOwned', COALESCE(NEW.products_owned, ARRAY[]::text[]),
      'productsCount', COALESCE(array_length(NEW.products_owned, 1), 0),
      'hasDisputed', COALESCE(NEW.has_disputed, false),
      'disputedAmount', COALESCE(NEW.disputed_amount, 0)
    ),
    'engagement', jsonb_build_object(
      'leadScore', COALESCE(NEW.lead_score, 0),
      'engagementScore', COALESCE(NEW.engagement_score, 0),
      'likelihoodScore', COALESCE(NEW.likelihood_to_buy_score, 0),
      'sentiment', NEW.sentiment,
      'lastEngagement', NEW.last_engagement_date
    ),
    'trading', jsonb_build_object(
      'experience', NEW.trading_experience,
      'style', NEW.trading_style,
      'accountSize', NEW.account_size,
      'riskTolerance', NEW.risk_tolerance,
      'interests', COALESCE(NEW.products_interested, ARRAY[]::text[]),
      'goals', COALESCE(NEW.goals, ARRAY[]::text[]),
      'sectors', COALESCE(NEW.sectors_of_interest, ARRAY[]::text[])
    ),
    'behavioral', jsonb_build_object(
      'personalityType', NEW.personality_type,
      'tags', COALESCE(NEW.behavioral_tags, ARRAY[]::text[]),
      'regularTags', COALESCE(NEW.tags, ARRAY[]::text[]),
      'communicationStyle', COALESCE(NEW.ai_profile->>'communication_style', 'Not analyzed'),
      'objections', NEW.objections
    ),
    'insights', jsonb_build_object(
      'summary', COALESCE(NEW.ai_profile->>'summary', 'No AI summary available'),
      'lastUpdated', NOW()
    )
  );
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_customer_profile
BEFORE INSERT OR UPDATE ON contacts
FOR EACH ROW
EXECUTE FUNCTION auto_refresh_customer_profile();

-- Step 2: Simplify get_customer_profile to read-only
CREATE OR REPLACE FUNCTION get_customer_profile(p_contact_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_profile JSONB;
BEGIN
  SELECT customer_profile INTO v_profile
  FROM contacts
  WHERE id = p_contact_id;
  
  RETURN v_profile;
END;
$$;

-- Step 3: Backfill existing contacts
UPDATE contacts
SET updated_at = NOW()
WHERE customer_profile IS NULL;