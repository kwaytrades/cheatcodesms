-- Create agent_type_configs table
CREATE TABLE agent_type_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_type text UNIQUE NOT NULL,
  system_prompt text,
  first_message_template text,
  follow_up_template text,
  conversion_template text,
  tone text DEFAULT 'professional',
  max_messages_per_week integer DEFAULT 3,
  is_active boolean DEFAULT true,
  
  -- Trigger rules
  trigger_no_reply_48h boolean DEFAULT true,
  trigger_product_page_visit boolean DEFAULT true,
  trigger_milestone_reached boolean DEFAULT false,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE agent_type_configs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all configs
CREATE POLICY "Authenticated users can view agent configs"
  ON agent_type_configs FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert/update configs
CREATE POLICY "Authenticated users can manage agent configs"
  ON agent_type_configs FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create updated_at trigger
CREATE TRIGGER agent_type_configs_updated_at
  BEFORE UPDATE ON agent_type_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();