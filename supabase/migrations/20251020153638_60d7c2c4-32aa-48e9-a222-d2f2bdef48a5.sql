-- Create storage buckets for Content Studio

-- Create content-videos bucket (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'content-videos',
  'content-videos',
  false,
  524288000, -- 500MB
  ARRAY['video/webm', 'video/mp4', 'video/quicktime']
) ON CONFLICT (id) DO NOTHING;

-- Create content-thumbnails bucket (public)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'content-thumbnails',
  'content-thumbnails',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Storage policies for content-videos (private)
CREATE POLICY "Users can upload their own videos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'content-videos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own videos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'content-videos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own videos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'content-videos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Storage policies for content-thumbnails (public read, authenticated write)
CREATE POLICY "Anyone can view thumbnails"
ON storage.objects FOR SELECT
USING (bucket_id = 'content-thumbnails');

CREATE POLICY "Authenticated users can upload thumbnails"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'content-thumbnails' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "Users can delete their own thumbnails"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'content-thumbnails' AND
  auth.uid()::text = (storage.foldername(name))[1]
);