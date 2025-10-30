import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

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

    console.log('Downloading file from:', filePath);

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('product-documents')
      .download(filePath);

    if (downloadError) {
      console.error('Download error:', downloadError);
      throw new Error(`Failed to download file: ${downloadError.message}`);
    }

    // Determine file type from extension
    const extension = filePath.split('.').pop()?.toLowerCase();
    console.log('File extension:', extension);

    let content = '';

    if (extension === 'txt') {
      // Parse TXT files directly
      content = await fileData.text();
    } else if (extension === 'pdf') {
      // For PDF, convert to array buffer and extract text
      const arrayBuffer = await fileData.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Simple PDF text extraction (basic approach)
      content = await extractTextFromPDF(uint8Array);
    } else if (extension === 'doc' || extension === 'docx') {
      // For DOC/DOCX, we'll extract what we can
      // Note: Full DOC/DOCX parsing requires additional libraries
      const text = await fileData.text();
      content = text;
    } else {
      throw new Error(`Unsupported file type: ${extension}`);
    }

    console.log('Extracted content length:', content.length);

    return new Response(
      JSON.stringify({
        success: true,
        content: content.trim(),
        fileType: extension
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in parse-product-document:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

// Basic PDF text extraction function
async function extractTextFromPDF(pdfData: Uint8Array): Promise<string> {
  const pdfText = new TextDecoder().decode(pdfData);
  let extractedText = '';

  // Extract text between BT (Begin Text) and ET (End Text) operators
  const btPattern = /BT\s+(.*?)\s+ET/gs;
  const matches = pdfText.matchAll(btPattern);
  
  for (const match of matches) {
    const textBlock = match[1];
    
    // Extract text from Tj operators (show text)
    const tjPattern = /\((.*?)\)\s*Tj/g;
    const tjMatches = textBlock.matchAll(tjPattern);
    for (const tjMatch of tjMatches) {
      extractedText += tjMatch[1] + ' ';
    }
    
    // Extract text from TJ operators (show text with positioning)
    const tjArrayPattern = /\[(.*?)\]\s*TJ/g;
    const tjArrayMatches = textBlock.matchAll(tjArrayPattern);
    for (const tjArrayMatch of tjArrayMatches) {
      const arrayContent = tjArrayMatch[1];
      const stringPattern = /\((.*?)\)/g;
      const stringMatches = arrayContent.matchAll(stringPattern);
      for (const stringMatch of stringMatches) {
        extractedText += stringMatch[1] + ' ';
      }
    }
  }

  // Also try to extract from stream objects
  const streamPattern = /stream\s+(.*?)\s+endstream/gs;
  const streamMatches = pdfText.matchAll(streamPattern);
  
  for (const streamMatch of streamMatches) {
    const streamContent = streamMatch[1];
    // Look for readable text patterns
    const readablePattern = /[A-Za-z]{3,}/g;
    const readableMatches = streamContent.matchAll(readablePattern);
    for (const readableMatch of readableMatches) {
      extractedText += readableMatch[0] + ' ';
    }
  }

  // Clean up the extracted text
  extractedText = extractedText
    .replace(/\s+/g, ' ')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '')
    .replace(/\\t/g, ' ')
    .trim();

  if (extractedText.length < 50) {
    throw new Error('Could not extract sufficient text from PDF. The file may be image-based, encrypted, or use unsupported encoding.');
  }

  return extractedText;
}