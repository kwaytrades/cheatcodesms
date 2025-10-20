-- Create storage bucket for knowledge base documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('knowledge-base', 'knowledge-base', false);

-- Create knowledge_base table
CREATE TABLE public.knowledge_base (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  content TEXT,
  file_path TEXT,
  file_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;

-- Admin can do everything (you'll need to be authenticated)
CREATE POLICY "Authenticated users can view knowledge base"
ON public.knowledge_base
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert knowledge base"
ON public.knowledge_base
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update knowledge base"
ON public.knowledge_base
FOR UPDATE
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete knowledge base"
ON public.knowledge_base
FOR DELETE
USING (auth.role() = 'authenticated');

-- Storage policies for knowledge base bucket
CREATE POLICY "Authenticated users can upload knowledge base files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'knowledge-base' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can view knowledge base files"
ON storage.objects
FOR SELECT
USING (bucket_id = 'knowledge-base');

CREATE POLICY "Authenticated users can update knowledge base files"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'knowledge-base' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can delete knowledge base files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'knowledge-base' AND
  auth.role() = 'authenticated'
);

-- Add trigger for updated_at
CREATE TRIGGER update_knowledge_base_updated_at
BEFORE UPDATE ON public.knowledge_base
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();