-- Make user_id nullable in content_videos and content_scripts since workspace_id is now the primary isolation
ALTER TABLE content_videos ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE content_scripts ALTER COLUMN user_id DROP NOT NULL;

-- Set default user_id for existing records without one
UPDATE content_videos SET user_id = (SELECT id FROM auth.users LIMIT 1) WHERE user_id IS NULL;
UPDATE content_scripts SET user_id = (SELECT id FROM auth.users LIMIT 1) WHERE user_id IS NULL;