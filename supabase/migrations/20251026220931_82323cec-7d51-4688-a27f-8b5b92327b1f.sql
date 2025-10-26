-- Add tone_presets column to style_guides table
ALTER TABLE style_guides 
ADD COLUMN IF NOT EXISTS tone_presets JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN style_guides.tone_presets IS 'Array of custom tone presets: [{"name": "kway_direct", "label": "Kway Direct", "instructions": "Be direct..."}]';