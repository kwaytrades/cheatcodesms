import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { filePath } = await req.json();
    
    if (!filePath) {
      throw new Error('File path is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Downloading PDF from storage:', filePath);
    
    // Download PDF from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('knowledge-base')
      .download(filePath);

    if (downloadError) {
      console.error('Download error:', downloadError);
      throw new Error(`Failed to download PDF: ${downloadError.message}`);
    }

    // Convert Blob to ArrayBuffer
    const arrayBuffer = await fileData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    console.log('Parsing PDF with pdf-parse...');

    // Use pdf-parse library to extract text
    // Note: We'll use a simple text extraction approach
    const textContent = await extractTextFromPDF(uint8Array);

    console.log('PDF parsed successfully, extracted', textContent.length, 'characters');

    return new Response(
      JSON.stringify({ 
        text: textContent,
        content: textContent,
        length: textContent.length,
        pageCount: 1
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('Error in parse-pdf function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to parse PDF' 
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});

// Enhanced PDF text extraction
async function extractTextFromPDF(pdfData: Uint8Array): Promise<string> {
  try {
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const text = decoder.decode(pdfData);
    
    console.log('PDF data size:', pdfData.length, 'bytes');
    
    let extractedText = '';
    const textChunks: string[] = [];
    
    // Method 1: Extract from BT/ET blocks (text objects)
    const btPattern = /BT\s+([\s\S]*?)\s+ET/g;
    let btMatches = text.matchAll(btPattern);
    
    for (const match of btMatches) {
      const textBlock = match[1];
      
      // Extract text from Tj operators: (text) Tj
      const tjPattern = /\(([^)]+)\)\s*Tj/g;
      let tjMatches = textBlock.matchAll(tjPattern);
      for (const tjMatch of tjMatches) {
        textChunks.push(tjMatch[1]);
      }
      
      // Extract text from TJ operators: [(text)] TJ or [(text)(more)] TJ
      const tjArrayPattern = /\[([\s\S]*?)\]\s*TJ/g;
      let tjArrayMatches = textBlock.matchAll(tjArrayPattern);
      for (const tjArrayMatch of tjArrayMatches) {
        const arrayContent = tjArrayMatch[1];
        const textInParens = /\(([^)]+)\)/g;
        let parenMatches = arrayContent.matchAll(textInParens);
        for (const parenMatch of parenMatches) {
          textChunks.push(parenMatch[1]);
        }
      }
      
      // Extract text from ' and " operators (move and show text)
      const quotePattern = /\(([^)]+)\)\s*['"]|<([0-9A-Fa-f]+)>\s*['"]]/g;
      let quoteMatches = textBlock.matchAll(quotePattern);
      for (const quoteMatch of quoteMatches) {
        if (quoteMatch[1]) textChunks.push(quoteMatch[1]);
      }
    }
    
    // Method 2: Extract from stream objects
    const streamPattern = /stream\s+([\s\S]*?)\s+endstream/g;
    let streamMatches = text.matchAll(streamPattern);
    
    for (const match of streamMatches) {
      const streamData = match[1];
      // Look for readable text sequences in streams
      const readablePattern = /\(([^)]{3,})\)/g;
      let readableMatches = streamData.matchAll(readablePattern);
      for (const readableMatch of readableMatches) {
        textChunks.push(readableMatch[1]);
      }
    }
    
    // Combine all extracted chunks
    extractedText = textChunks
      .map(chunk => chunk
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\\(/g, '(')
        .replace(/\\\)/g, ')')
        .replace(/\\\\/g, '\\')
      )
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    console.log('Extracted text length:', extractedText.length, 'characters');
    console.log('First 500 chars:', extractedText.substring(0, 500));
    
    // If we still don't have enough text, try a more aggressive extraction
    if (extractedText.length < 200) {
      console.log('Attempting aggressive text extraction...');
      const allParenContent = text.match(/\(([^)]{3,}?)\)/g);
      if (allParenContent && allParenContent.length > 0) {
        extractedText = allParenContent
          .map(s => s.slice(1, -1))
          .join(' ')
          .replace(/\\n/g, '\n')
          .replace(/\s+/g, ' ')
          .trim();
        console.log('Aggressive extraction yielded:', extractedText.length, 'characters');
      }
    }
    
    if (extractedText.length < 100) {
      throw new Error(`Only extracted ${extractedText.length} characters. PDF may be image-based, encrypted, or use unsupported encoding.`);
    }
    
    return extractedText;
    
  } catch (error) {
    console.error('PDF extraction error:', error);
    throw error;
  }
}
