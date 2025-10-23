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
    const { category, documentType = 'textbook' } = await req.json();
    
    if (!category) {
      throw new Error('Category is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`Re-processing metadata for category: ${category}, documentType: ${documentType}`);

    // Fetch all chunks that need re-processing
    const { data: chunks, error: fetchError } = await supabase
      .from('knowledge_base')
      .select('id, content, chunk_metadata, parent_document_id')
      .eq('category', category)
      .not('parent_document_id', 'is', null)
      .order('chunk_index', { ascending: true });

    if (fetchError) throw fetchError;

    const totalChunks = chunks?.length || 0;
    console.log(`Found ${totalChunks} chunks to re-process`);

    // Create a readable stream for progress updates
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        
        const sendProgress = (data: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        sendProgress({ 
          type: 'start', 
          total: totalChunks,
          message: `Starting re-processing of ${totalChunks} chunks...`
        });

        let processed = 0;
        let failed = 0;
        let previousChapterContext: any = null;

        for (const chunk of chunks || []) {
          try {
            // Call extract-chunk-metadata for each chunk
            const { data: metadata, error: metadataError } = await supabase.functions.invoke(
              'extract-chunk-metadata',
              {
                body: {
                  text: chunk.content,
                  pageNumber: chunk.chunk_metadata?.page_number,
                  previousChapterContext,
                  documentType
                }
              }
            );

            if (metadataError) {
              console.error(`Failed to extract metadata for chunk ${chunk.id}:`, metadataError);
              failed++;
              sendProgress({
                type: 'progress',
                processed: processed + failed,
                total: totalChunks,
                failed,
                percent: Math.round(((processed + failed) / totalChunks) * 100),
                message: `Failed to process chunk ${processed + failed}/${totalChunks}`
              });
              continue;
            }

            // Update chunk with new metadata
            const updatedMetadata = {
              ...chunk.chunk_metadata,
              ...metadata,
              document_type: documentType,
              extraction_method: 'llm',
              reprocessed_at: new Date().toISOString()
            };

            const { error: updateError } = await supabase
              .from('knowledge_base')
              .update({ chunk_metadata: updatedMetadata })
              .eq('id', chunk.id);

            if (updateError) {
              console.error(`Failed to update chunk ${chunk.id}:`, updateError);
              failed++;
              sendProgress({
                type: 'progress',
                processed: processed + failed,
                total: totalChunks,
                failed,
                percent: Math.round(((processed + failed) / totalChunks) * 100),
                message: `Failed to update chunk ${processed + failed}/${totalChunks}`
              });
              continue;
            }

            // Update context for next chunk
            if (metadata.chapter_number && metadata.chapter_title) {
              previousChapterContext = {
                chapter_number: metadata.chapter_number,
                chapter_title: metadata.chapter_title
              };
            }

            processed++;
            console.log(`✅ Re-processed chunk ${processed}/${totalChunks}`);

            // Send progress update every chunk
            sendProgress({
              type: 'progress',
              processed,
              total: totalChunks,
              failed,
              percent: Math.round((processed / totalChunks) * 100),
              message: `Re-processed ${processed}/${totalChunks} chunks`,
              currentChapter: previousChapterContext?.chapter_title
            });

          } catch (chunkError) {
            console.error(`Error processing chunk ${chunk.id}:`, chunkError);
            failed++;
            sendProgress({
              type: 'progress',
              processed: processed + failed,
              total: totalChunks,
              failed,
              percent: Math.round(((processed + failed) / totalChunks) * 100),
              message: `Error processing chunk ${processed + failed}/${totalChunks}`
            });
          }
        }

        // Send completion
        sendProgress({
          type: 'complete',
          processed,
          failed,
          total: totalChunks,
          message: `✅ Re-processed ${processed} chunks (${failed} failed)`
        });

        controller.close();
      }
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Error in reprocess-metadata:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
