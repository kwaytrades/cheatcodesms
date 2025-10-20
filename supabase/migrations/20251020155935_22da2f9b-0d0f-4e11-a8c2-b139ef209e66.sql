-- Simplify style_guides table to use a single instructions field
ALTER TABLE public.style_guides 
DROP COLUMN IF EXISTS brand_voice,
DROP COLUMN IF EXISTS content_instructions,
DROP COLUMN IF EXISTS tone_preferences,
DROP COLUMN IF EXISTS hook_guidelines,
DROP COLUMN IF EXISTS cta_templates,
DROP COLUMN IF EXISTS additional_notes;

-- Add single comprehensive instructions field
ALTER TABLE public.style_guides 
ADD COLUMN instructions TEXT,
ADD COLUMN file_name TEXT;