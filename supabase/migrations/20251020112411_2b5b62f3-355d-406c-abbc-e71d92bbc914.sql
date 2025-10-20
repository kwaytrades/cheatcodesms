-- Add channel support to campaigns table
ALTER TABLE campaigns 
ADD COLUMN channel text NOT NULL DEFAULT 'sms' CHECK (channel IN ('sms', 'email'));

-- Add email-specific fields to campaigns
ALTER TABLE campaigns
ADD COLUMN subject text,
ADD COLUMN from_email text,
ADD COLUMN from_name text,
ADD COLUMN reply_to text,
ADD COLUMN html_template text,
ADD COLUMN plain_text_template text;

-- Update campaign_messages to support email
ALTER TABLE campaign_messages
ADD COLUMN to_email text,
ADD COLUMN subject text,
ADD COLUMN html_body text,
ADD COLUMN plain_text_body text;

-- Add index for channel filtering
CREATE INDEX idx_campaigns_channel ON campaigns(channel);

-- Add comment for clarity
COMMENT ON COLUMN campaigns.channel IS 'Communication channel: sms or email';
COMMENT ON COLUMN campaigns.subject IS 'Email subject line (only for email campaigns)';
COMMENT ON COLUMN campaigns.from_email IS 'Sender email address (only for email campaigns)';
COMMENT ON COLUMN campaigns.from_name IS 'Sender name (only for email campaigns)';
COMMENT ON COLUMN campaigns.reply_to IS 'Reply-to email address (only for email campaigns)';
COMMENT ON COLUMN campaigns.html_template IS 'HTML email template (only for email campaigns)';
COMMENT ON COLUMN campaigns.plain_text_template IS 'Plain text email template (only for email campaigns)';