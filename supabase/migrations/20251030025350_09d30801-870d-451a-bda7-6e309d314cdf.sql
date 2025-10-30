-- Add campaign_strategy column to ai_sales_campaigns table
ALTER TABLE ai_sales_campaigns 
ADD COLUMN IF NOT EXISTS campaign_strategy JSONB DEFAULT jsonb_build_object(
  'primary_objective', 'close_sales',
  'products', '[]'::jsonb,
  'value_propositions', '[]'::jsonb,
  'pricing', '{}'::jsonb,
  'discount_strategy', jsonb_build_object(
    'approach', 'no_discounts',
    'amount', null,
    'expiration', null
  ),
  'sales_intensity', 5,
  'objection_handling', 'address_with_education',
  'campaign_context', '',
  'key_talking_points', '[]'::jsonb,
  'avoid_topics', '[]'::jsonb,
  'competitive_positioning', '',
  'custom_schedule', '[]'::jsonb
);

-- Add comment to explain the column
COMMENT ON COLUMN ai_sales_campaigns.campaign_strategy IS 'Campaign-specific strategy including goals, products, sales approach, and custom instructions';