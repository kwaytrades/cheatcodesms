-- Mark old tables as deprecated (keep for reference, don't drop)
COMMENT ON TABLE conversations IS 'DEPRECATED: Migrated to agent_conversations. Do not use for new features. Use agent_conversations with agent_type field instead.';
COMMENT ON TABLE messages IS 'DEPRECATED: Migrated to agent_messages. Do not use for new features. Use agent_messages with conversation_id reference to agent_conversations.';

-- Create function to warn if old tables are accidentally used
CREATE OR REPLACE FUNCTION prevent_old_table_insert()
RETURNS TRIGGER AS $$
BEGIN
  RAISE WARNING 'Table % is deprecated. Use agent_conversations/agent_messages instead.', TG_TABLE_NAME;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers to warn on insert to old tables
CREATE TRIGGER warn_conversations_deprecated
  BEFORE INSERT ON conversations
  FOR EACH ROW EXECUTE FUNCTION prevent_old_table_insert();

CREATE TRIGGER warn_messages_deprecated
  BEFORE INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION prevent_old_table_insert();