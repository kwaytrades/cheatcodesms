-- Add configuration columns to agent_type_configs for Trade Analysis Agent
ALTER TABLE agent_type_configs 
ADD COLUMN IF NOT EXISTS style_guide_config JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS system_prompts JSONB DEFAULT '{
  "analysis_prompt": "You are a professional stock trading analyst. Analyze the given stock ticker with technical analysis expertise.",
  "intent_classification_prompt": "Classify user intent for stock trading conversations.",
  "educational_prompt": "Provide clear, concise trading education answers.",
  "guardrails_prompt": "Maintain conversation boundaries for trading discussions only."
}'::jsonb,
ADD COLUMN IF NOT EXISTS guardrails_config JSONB DEFAULT '{
  "confidence_threshold": 0.7,
  "max_analyses_per_hour": 10,
  "max_messages_per_day": 50,
  "allowed_educational_topics": ["RSI", "MACD", "Support", "Resistance", "Volume", "Chart Patterns", "Candlesticks"],
  "restricted_topics": ["politics", "general chat", "personal advice"],
  "multi_ticker_behavior": "clarification_required",
  "educational_response_max_length": 160,
  "credit_warning_thresholds": [3, 1, 0]
}'::jsonb;

-- Insert default config for trade_analysis if not exists
INSERT INTO agent_type_configs (agent_type, system_prompt, style_guide_config, system_prompts, guardrails_config)
VALUES (
  'trade_analysis',
  'You are a professional stock trading analyst helping users with technical analysis.',
  '{
    "tone": "professional",
    "personality": ["confident", "analytical", "supportive"],
    "language_complexity": "intermediate"
  }'::jsonb,
  '{
    "analysis_prompt": "You are a professional stock trading analyst. Provide technical analysis for {symbol} with current price {price}. Include support/resistance levels, momentum indicators, and setup type.",
    "intent_classification_prompt": "Classify the user message intent: analyze_stock, watchlist_add, watchlist_remove, check_credits, educational_question, off_topic.",
    "educational_prompt": "Answer trading questions clearly in under 160 characters. Focus on actionable insights.",
    "guardrails_prompt": "Only discuss stock trading topics. Redirect off-topic questions politely."
  }'::jsonb,
  '{
    "confidence_threshold": 0.7,
    "max_analyses_per_hour": 10,
    "max_messages_per_day": 50,
    "allowed_educational_topics": ["RSI", "MACD", "Support", "Resistance", "Volume", "Chart Patterns", "Candlesticks", "Moving Averages"],
    "restricted_topics": ["politics", "general chat", "personal advice", "financial advice"],
    "multi_ticker_behavior": "clarification_required",
    "educational_response_max_length": 160,
    "credit_warning_thresholds": [3, 1, 0]
  }'::jsonb
)
ON CONFLICT (agent_type) DO UPDATE SET
  style_guide_config = EXCLUDED.style_guide_config,
  system_prompts = EXCLUDED.system_prompts,
  guardrails_config = EXCLUDED.guardrails_config
WHERE agent_type_configs.agent_type = 'trade_analysis';