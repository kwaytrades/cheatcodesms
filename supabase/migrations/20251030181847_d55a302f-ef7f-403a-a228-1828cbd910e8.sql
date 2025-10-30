-- Add document storage columns to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS document_url text,
ADD COLUMN IF NOT EXISTS document_content text,
ADD COLUMN IF NOT EXISTS document_filename text,
ADD COLUMN IF NOT EXISTS document_parsed_at timestamp with time zone;

-- Create storage bucket for product documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-documents', 'product-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Add RLS policies for product documents bucket
CREATE POLICY "Authenticated users can upload product documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-documents');

CREATE POLICY "Authenticated users can view product documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'product-documents');

CREATE POLICY "Authenticated users can update product documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'product-documents');

CREATE POLICY "Authenticated users can delete product documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'product-documents');