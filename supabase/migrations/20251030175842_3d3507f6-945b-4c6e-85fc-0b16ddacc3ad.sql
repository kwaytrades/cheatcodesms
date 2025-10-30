-- Enhance products table with comprehensive fields
ALTER TABLE products ADD COLUMN IF NOT EXISTS sku text UNIQUE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_type text NOT NULL DEFAULT 'course';
ALTER TABLE products ADD COLUMN IF NOT EXISTS features jsonb DEFAULT '[]'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS benefits jsonb DEFAULT '[]'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS value_propositions jsonb DEFAULT '[]'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS target_audience text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS key_talking_points jsonb DEFAULT '[]'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS competitive_positioning text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS objection_responses jsonb DEFAULT '{}'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS pricing_tiers jsonb DEFAULT '[]'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS discount_options jsonb DEFAULT '[]'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS media_urls jsonb DEFAULT '{"images": [], "videos": []}'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- Add unique constraint on name for products table
ALTER TABLE products ADD CONSTRAINT products_name_unique UNIQUE (name);

-- Add RLS policies for products
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view products" ON products;
CREATE POLICY "Authenticated users can view products" ON products
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can manage products" ON products;
CREATE POLICY "Authenticated users can manage products" ON products
  FOR ALL USING (auth.role() = 'authenticated');

-- Add trigger for updated_at
DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at 
  BEFORE UPDATE ON products 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create contact_products junction table
CREATE TABLE IF NOT EXISTS contact_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  purchase_id uuid REFERENCES purchases(id) ON DELETE SET NULL,
  acquired_date timestamp with time zone DEFAULT now(),
  status text DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled', 'refunded')),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(contact_id, product_id)
);

ALTER TABLE contact_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage contact products" ON contact_products;
CREATE POLICY "Authenticated users can manage contact products" ON contact_products
  FOR ALL USING (auth.role() = 'authenticated');

CREATE INDEX IF NOT EXISTS idx_contact_products_contact_id ON contact_products(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_products_product_id ON contact_products(product_id);

-- Create campaign_products junction table
CREATE TABLE IF NOT EXISTS campaign_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES ai_sales_campaigns(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  priority integer DEFAULT 1,
  custom_messaging jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(campaign_id, product_id)
);

ALTER TABLE campaign_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage campaign products" ON campaign_products;
CREATE POLICY "Authenticated users can manage campaign products" ON campaign_products
  FOR ALL USING (auth.role() = 'authenticated');

CREATE INDEX IF NOT EXISTS idx_campaign_products_campaign_id ON campaign_products(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_products_product_id ON campaign_products(product_id);

-- Migrate existing string-based products to products table
INSERT INTO products (name, product_type, description, is_active)
SELECT DISTINCT 
  unnest(products_owned) as name,
  'course' as product_type,
  'Migrated product' as description,
  true as is_active
FROM contacts
WHERE products_owned IS NOT NULL AND array_length(products_owned, 1) > 0
ON CONFLICT (name) DO NOTHING;

-- Create contact_products records from existing data
INSERT INTO contact_products (contact_id, product_id, acquired_date)
SELECT 
  c.id,
  p.id,
  COALESCE(c.last_purchase_date, c.created_at)
FROM contacts c
CROSS JOIN LATERAL unnest(c.products_owned) AS product_name
JOIN products p ON p.name = product_name
WHERE c.products_owned IS NOT NULL
ON CONFLICT (contact_id, product_id) DO NOTHING;