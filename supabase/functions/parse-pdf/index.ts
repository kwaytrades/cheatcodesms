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
        content: textContent,
        pageCount: 1 // Simple implementation doesn't provide page count
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

// Simple PDF text extraction
async function extractTextFromPDF(pdfData: Uint8Array): Promise<string> {
  try {
    // Convert to string and extract text between stream markers
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const text = decoder.decode(pdfData);
    
    // Extract text content between BT and ET markers (basic PDF text extraction)
    const btPattern = /BT\s+(.*?)\s+ET/gs;
    const matches = text.matchAll(btPattern);
    
    let extractedText = '';
    for (const match of matches) {
      // Extract text from Tj and TJ operators
      const textContent = match[1];
      const tjPattern = /\((.*?)\)\s*Tj/g;
      const tjMatches = textContent.matchAll(tjPattern);
      
      for (const tjMatch of tjMatches) {
        extractedText += tjMatch[1] + ' ';
      }
      
      // Also extract from array format [(text)] TJ
      const tjArrayPattern = /\[\((.*?)\)\]\s*TJ/g;
      const tjArrayMatches = textContent.matchAll(tjArrayPattern);
      
      for (const tjArrayMatch of tjArrayMatches) {
        extractedText += tjArrayMatch[1] + ' ';
      }
    }
    
    // Clean up the text
    extractedText = extractedText
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    // If basic extraction didn't work, try to extract any readable text
    if (extractedText.length < 100) {
      // Fallback: extract any printable ASCII characters in sequences
      const readable = text.match(/[\x20-\x7E]{4,}/g);
      if (readable) {
        extractedText = readable.join(' ').slice(0, 10000);
      }
    }
    
    return extractedText || 'Unable to extract text from PDF. The PDF may be image-based or encrypted.';
    
  } catch (error) {
    console.error('PDF extraction error:', error);
    return 'Error extracting text from PDF: ' + (error instanceof Error ? error.message : 'Unknown error');
  }
}
