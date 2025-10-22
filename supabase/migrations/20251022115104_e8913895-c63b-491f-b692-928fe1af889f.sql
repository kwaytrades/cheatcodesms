-- Create a public storage bucket for Remotion bundles
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'remotion-bundles',
  'remotion-bundles',
  true,
  52428800, -- 50MB limit
  ARRAY['text/html', 'text/javascript', 'application/javascript', 'application/json']
);

-- Create RLS policies for the remotion-bundles bucket
CREATE POLICY "Public read access for remotion bundles"
ON storage.objects FOR SELECT
USING (bucket_id = 'remotion-bundles');

CREATE POLICY "Authenticated users can upload remotion bundles"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'remotion-bundles' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update remotion bundles"
ON storage.objects FOR UPDATE
USING (bucket_id = 'remotion-bundles' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete remotion bundles"
ON storage.objects FOR DELETE
USING (bucket_id = 'remotion-bundles' AND auth.role() = 'authenticated');