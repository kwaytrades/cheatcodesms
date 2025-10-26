-- Update X Thread terminology in style guides
UPDATE style_guides 
SET instructions = REPLACE(REPLACE(instructions, 'Twitter Thread Generator', 'X Thread Generator'), 'Twitter threads', 'X threads')
WHERE format = 'carousel';