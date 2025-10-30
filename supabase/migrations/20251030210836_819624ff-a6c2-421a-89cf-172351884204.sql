-- Add campaign_id column to scheduled_messages table
ALTER TABLE scheduled_messages 
ADD COLUMN campaign_id uuid REFERENCES ai_sales_campaigns(id);

-- Create index for performance
CREATE INDEX idx_scheduled_messages_campaign_id 
ON scheduled_messages(campaign_id);