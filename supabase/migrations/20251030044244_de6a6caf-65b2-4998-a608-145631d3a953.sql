-- Add channel field to ai_sales_campaigns table
ALTER TABLE ai_sales_campaigns 
ADD COLUMN channel TEXT NOT NULL DEFAULT 'sms' 
CHECK (channel IN ('sms', 'email'));