-- Add scoring_config column to agent_type_configs table
ALTER TABLE agent_type_configs 
ADD COLUMN IF NOT EXISTS scoring_config JSONB DEFAULT '{
  "methodology": "cheat_code",
  "weights": {
    "trend_strength": 20,
    "indicator_alignment": 20,
    "volume_confirmation": 15,
    "risk_reward_ratio": 20,
    "pattern_quality": 15,
    "momentum": 10
  },
  "setup_preferences": {
    "breakout": {"enabled": true, "min_score": 70},
    "reversal": {"enabled": true, "min_score": 75},
    "momentum": {"enabled": true, "min_score": 65}
  },
  "entry_exit_rules": {
    "entry_method": "support_resistance",
    "stop_loss_type": "atr_multiple",
    "stop_loss_atr_multiplier": 1.5,
    "targets": [
      {"type": "risk_multiple", "value": 2},
      {"type": "risk_multiple", "value": 3}
    ]
  },
  "indicator_settings": {
    "rsi_period": 14,
    "rsi_overbought": 70,
    "rsi_oversold": 30,
    "macd_fast": 12,
    "macd_slow": 26,
    "macd_signal": 9,
    "volume_threshold": 1.5
  }
}'::jsonb;

-- Update trade_analysis config with scoring_config
UPDATE agent_type_configs
SET scoring_config = '{
  "methodology": "cheat_code",
  "version": "1.0",
  "weights": {
    "trend_strength": 20,
    "indicator_alignment": 20,
    "volume_confirmation": 15,
    "risk_reward_ratio": 20,
    "pattern_quality": 15,
    "momentum": 10
  },
  "setup_preferences": {
    "breakout": {"enabled": true, "min_score": 70, "priority": 1},
    "reversal": {"enabled": true, "min_score": 75, "priority": 2},
    "momentum": {"enabled": true, "min_score": 65, "priority": 3},
    "consolidation": {"enabled": true, "min_score": 70, "priority": 4}
  },
  "entry_exit_rules": {
    "entry_method": "support_resistance",
    "entry_confirmation": "volume_surge",
    "stop_loss_type": "atr_multiple",
    "stop_loss_atr_multiplier": 1.5,
    "targets": [
      {"type": "risk_multiple", "value": 2, "partial_exit": 50},
      {"type": "risk_multiple", "value": 3, "partial_exit": 25}
    ]
  },
  "indicator_settings": {
    "rsi_period": 14,
    "rsi_overbought": 70,
    "rsi_oversold": 30,
    "macd_fast": 12,
    "macd_slow": 26,
    "macd_signal": 9,
    "volume_threshold": 1.5,
    "use_volume_profile": true,
    "sma_periods": [20, 50, 200]
  },
  "risk_parameters": {
    "max_risk_per_trade_pct": 2,
    "max_portfolio_heat": 6,
    "position_sizing_method": "fixed_percentage"
  }
}'::jsonb
WHERE agent_type = 'trade_analysis';