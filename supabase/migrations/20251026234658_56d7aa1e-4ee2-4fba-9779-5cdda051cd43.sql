-- Update style guide to remove confusing carousel instructions and clarify X thread format
UPDATE style_guides 
SET instructions = REPLACE(
  instructions,
  '## CAROUSEL OUTPUT FORMAT

**CRITICAL PARSING INSTRUCTIONS:**

- Output ONLY the raw text for each slide
- Format: "Slide 1:\n[text]\n\nSlide 2:\n[text]" etc.
- NO titles, NO visual instructions, NO formatting symbols like ** or ##
- Keep text concise and impactful (2-3 short sentences per slide max)
- First slide: Hook that grabs attention
- Middle slides: Key points, one idea per slide
- Last slide: Strong takeaway or CTA
- Professional but engaging tone

**PARSING REQUIREMENTS:**
- Must start with "Slide" + space + number + colon (e.g., "Slide 1:", "Slide 2:")
- Text content comes immediately after on a new line
- Each slide separated by double newline before next "Slide X:" header
- NO other formatting markers like [HOOK], [MAIN], timestamps
- NO markdown symbols (**, ##, etc.) in slide headers
- Just "Slide X:" then the text content

CRITICAL: Output EXACTLY in the format "Slide X:" followed by the text. NO other formatting, NO timestamps, NO [HOOK] labels.',
  '## X THREAD OUTPUT FORMAT

**CRITICAL: Follow Ali''s pattern for EVERY slide where it makes sense to list mechanisms, data, action items, or multiple key points.**

**Output structure:**
- Format as "Slide 1:\n[text]\n\nSlide 2:\n[text]" etc.
- Each slide separated by double newline

**Content structure for slides with bullets:**
Opening statement.

Context sentence explaining what it means.

Transition phrase:

🔸 First key point
🔸 Second key point
🔸 Third key point

Concluding punch line.

**Content structure for slides without bullets (single-point statements):**
Opening statement.

Context sentence explaining the concept.

Concluding punch line.

**Use bullets when:**
- Listing mechanisms or data points
- Breaking down multiple action items
- Showing historical patterns
- Presenting multiple reasons/factors

**Skip bullets when:**
- Making a single powerful statement
- Telling a narrative story
- Setting up the next point

**First slide:** Hook with thread indicator 🧵
**Last slide:** Summary + CTA (Algo V5 link)

CRITICAL: Output in "Slide X:" format. NO markdown symbols (**, ##) in headers. Follow Ali''s voice and structure patterns from examples above.'
)
WHERE format = 'carousel';