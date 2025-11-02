-- Fix the auto_refresh_customer_profile function to remove non-existent field references
CREATE OR REPLACE FUNCTION public.auto_refresh_customer_profile()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
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
      'likelihoodScore', COALESCE(NEW.likelihood_to_buy_score, 0),
      'sentiment', NEW.sentiment,
      'lastEngagement', NEW.last_engagement_date,
      'engagementVelocity', COALESCE(NEW.engagement_velocity, 0)
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
$function$;