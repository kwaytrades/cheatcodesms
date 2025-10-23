import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Trash2, Upload, FileText, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { KnowledgeBaseEmbeddings } from "./KnowledgeBaseEmbeddings";
import { AgentTypeIcon } from "./agents/AgentTypeIcon";
import { Progress } from "@/components/ui/progress";
import * as pdfjsLib from 'pdfjs-dist';

const AGENT_TYPES = [
  { id: 'sales_agent', name: 'Sam - Sales Agent', description: 'Proactive outreach to qualify and convert leads' },
  { id: 'customer_service', name: 'Casey - Customer Service', description: 'Handles inbound support questions and issues' },
  { id: 'webinar', name: 'Wendi - Webinar Agent', description: 'Guides contacts through webinar signup process' },
  { id: 'textbook', name: 'Thomas - Textbook Agent', description: 'Helps with textbook purchase decisions' },
  { id: 'flashcards', name: 'Frank - Flashcards Agent', description: 'Promotes flashcard usage and learning' },
  { id: 'algo_monthly', name: 'Adam - Algo Monthly Agent', description: 'Nurtures algorithmic trading subscription leads' },
  { id: 'ccta', name: 'Chris - CCTA Agent', description: 'Guides through CCTA certification process' },
  { id: 'lead_nurture', name: 'Jamie - Lead Nurture Agent', description: 'General lead nurturing for undecided prospects' },
];

export const KnowledgeBase = () => {
  const queryClient = useQueryClient();
  const [selectedAgent, setSelectedAgent] = useState("");
  const [manualContent, setManualContent] = useState({
    title: "",
    content: "",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{
    isUploading: boolean;
    stage: 'idle' | 'uploading' | 'processing' | 'chunking' | 'embedding' | 'complete' | 'error';
    progress: number;
    chunks?: number;
    fileName?: string;
    error?: string;
    totalPages?: number;
    currentBatch?: number;
    totalBatches?: number;
    batchDetails?: Array<{
      batchNumber: number;
      startPage: number;
      endPage: number;
      status: 'pending' | 'processing' | 'complete' | 'failed';
      chunks?: number;
      error?: string;
    }>;
  }>({
    isUploading: false,
    stage: 'idle',
    progress: 0
  });

  // Client-side chunking function (moved from edge function to avoid resource limits)
  const chunkTextClientSide = (text: string, chunkSize = 2000, overlap = 200): string[] => {
    const chunks: string[] = [];
    let start = 0;
    
    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      chunks.push(text.slice(start, end));
      start = end - overlap; // Create overlap between chunks
      
      if (start >= text.length - overlap) break;
    }
    
    return chunks;
  };

  const { data: documents, isLoading } = useQuery({
    queryKey: ["knowledge-base", selectedAgent],
    queryFn: async () => {
      let query = supabase
        .from("knowledge_base")
        .select(`
          *,
          chunks:knowledge_base!parent_document_id(count)
        `)
        .is("parent_document_id", null);

      // Filter by selected agent if one is selected
      if (selectedAgent) {
        query = query.eq("category", `agent_${selectedAgent}`);
      } else {
        // Show all agent categories if no agent selected
        query = query.like("category", "agent_%");
      }

      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const addManualDocument = useMutation({
    mutationFn: async (doc: { title: string; category: string; content: string; file_path?: string; file_type?: string }) => {
      setUploadProgress({ isUploading: true, stage: 'uploading', progress: 25, fileName: doc.title });
      
      const { data, error } = await supabase
        .from("knowledge_base")
        .insert([doc])
        .select()
        .single();

      if (error) {
        throw error;
      }

      setUploadProgress({ isUploading: true, stage: 'chunking', progress: 50, fileName: doc.title });
      
      // Chunk content client-side
      const chunks = chunkTextClientSide(doc.content);
      console.log(`📦 Created ${chunks.length} chunks for manual document`);

      // Store each chunk directly to database
      for (let i = 0; i < chunks.length; i++) {
        await supabase
          .from('knowledge_base')
          .insert({
            title: `${doc.title} - Chunk ${i + 1}`,
            content: chunks[i],
            category: doc.category,
            parent_document_id: data.id,
            chunk_index: i + 1,
            chunk_metadata: {
              chunk_size: chunks[i].length,
              total_chunks: chunks.length
            }
          });
      }

      const chunksCreated = chunks.length;
      setUploadProgress({ 
        isUploading: true, 
        stage: 'complete', 
        progress: 100, 
        chunks: chunksCreated,
        fileName: doc.title
      });
      
      setTimeout(() => {
        setUploadProgress({ isUploading: false, stage: 'idle', progress: 0 });
      }, 5000);
      
      toast.success(`Document embedded into ${chunksCreated} searchable chunks`);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-base", selectedAgent] });
      setManualContent({ title: "", content: "" });
    },
    onError: (error) => {
      setUploadProgress({ 
        isUploading: true, 
        stage: 'error', 
        progress: 0,
        error: error.message
      });
      toast.error("Failed to add document: " + error.message);
    },
  });

  const deleteDocument = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("knowledge_base")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-base", selectedAgent] });
      toast.success("Document deleted");
    },
    onError: (error) => {
      toast.error("Failed to delete: " + error.message);
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!selectedAgent) {
      toast.error("Please select an agent first");
      return;
    }

    // Check file size
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > 50) {
      toast.error(`File is ${fileSizeMB.toFixed(1)}MB. Maximum supported size is 50MB. Consider splitting the PDF.`);
      return;
    }

    if (fileSizeMB > 20) {
      toast.warning(`Large file detected (${fileSizeMB.toFixed(1)}MB). Processing may take 1-2 minutes.`);
    }

    setSelectedFile(file);
    toast.success(`File "${file.name}" selected (${fileSizeMB.toFixed(1)}MB). Click "Add to Knowledge Base" to process.`);
  };

  const parsePDFBatch = async (
    file: File, 
    startPage: number, 
    endPage: number
  ): Promise<string> => {
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
      
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      let fullText = '';
      const actualEndPage = Math.min(endPage, pdf.numPages);
      
      console.log(`Extracting pages ${startPage}-${actualEndPage} from ${pdf.numPages} total pages`);
      
      for (let i = startPage; i <= actualEndPage; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += `\n--- Page ${i} ---\n` + pageText + '\n';
      }
      
      return fullText;
    } catch (error) {
      console.error(`PDF parsing error (pages ${startPage}-${endPage}):`, error);
      throw new Error(`Failed to parse PDF pages ${startPage}-${endPage}. The file may be corrupted, encrypted, or image-based.`);
    }
  };

  const handleProcessFile = async () => {
    if (!selectedFile) return;

    try {
      const fileSizeMB = selectedFile.size / (1024 * 1024);
      const fileExt = selectedFile.name.split('.').pop();
      
      setUploadProgress({ isUploading: true, stage: 'uploading', progress: 5, fileName: selectedFile.name });
      
      // Upload original file to storage
      const fileName = `${selectedAgent}_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('knowledge-base')
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('knowledge-base')
        .getPublicUrl(filePath);

      // Handle PDF with batch processing
      if (fileExt?.toLowerCase() === 'pdf') {
        await processPDFInBatches(selectedFile, publicUrl, fileExt);
      } else if (['txt', 'md', 'text'].includes(fileExt?.toLowerCase() || '')) {
        // Handle text files (no batching needed)
        const content = await selectedFile.text();
        
        if (!content || content.length === 0) {
          throw new Error('No content extracted from file. Please ensure the file contains text.');
        }

        setUploadProgress({ isUploading: true, stage: 'processing', progress: 50, fileName: selectedFile.name });

        const { data: kbEntry, error: dbError } = await supabase
          .from('knowledge_base')
          .insert({
            title: selectedFile.name,
            category: `agent_${selectedAgent}`,
            file_path: publicUrl,
            file_type: fileExt,
            content: content,
          })
          .select()
          .single();

        if (dbError) throw dbError;

        setUploadProgress({ isUploading: true, stage: 'chunking', progress: 75, fileName: selectedFile.name });

        // Chunk content client-side
        const chunks = chunkTextClientSide(content);
        console.log(`📦 Created ${chunks.length} chunks for text file`);

        // Store each chunk directly to database
        for (let i = 0; i < chunks.length; i++) {
          await supabase
            .from('knowledge_base')
            .insert({
              title: `${selectedFile.name} - Chunk ${i + 1}`,
              content: chunks[i],
              category: `agent_${selectedAgent}`,
              parent_document_id: kbEntry.id,
              chunk_index: i + 1,
              chunk_metadata: {
                chunk_size: chunks[i].length,
                total_chunks: chunks.length
              }
            });
        }

        queryClient.invalidateQueries({ queryKey: ["knowledge-base", selectedAgent] });
        
        setUploadProgress({ 
          isUploading: true, 
          stage: 'complete', 
          progress: 100, 
          chunks: chunks.length,
          fileName: selectedFile.name
        });
        
        setTimeout(() => {
          setUploadProgress({ isUploading: false, stage: 'idle', progress: 0 });
          setSelectedFile(null);
        }, 5000);
        
        toast.success(`File processed into ${chunks.length} searchable chunks`);
      }
    } catch (error: any) {
      console.error('File processing error:', error);
      setUploadProgress({ 
        isUploading: true, 
        stage: 'error', 
        progress: 0, 
        fileName: selectedFile?.name,
        error: error.message
      });
      toast.error("Failed to process file: " + error.message);
      
      setTimeout(() => {
        setUploadProgress({ isUploading: false, stage: 'idle', progress: 0 });
      }, 8000);
    }
  };

  const processPDFInBatches = async (file: File, publicUrl: string, fileExt: string) => {
    try {
      // Get total page count - use worker from npm package
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const totalPages = pdf.numPages;
      
      const PAGES_PER_BATCH = 50;
      const totalBatches = Math.ceil(totalPages / PAGES_PER_BATCH);
      
      console.log(`📕 Processing ${totalPages}-page PDF in ${totalBatches} batches`);
      
      // Initialize batch tracking
      const batchDetails = Array.from({ length: totalBatches }, (_, i) => ({
        batchNumber: i + 1,
        startPage: i * PAGES_PER_BATCH + 1,
        endPage: Math.min((i + 1) * PAGES_PER_BATCH, totalPages),
        status: 'pending' as 'pending' | 'processing' | 'complete' | 'failed',
        chunks: undefined as number | undefined,
        error: undefined as string | undefined,
      }));
      
      setUploadProgress({
        isUploading: true,
        stage: 'processing',
        progress: 10,
        fileName: file.name,
        totalPages,
        totalBatches,
        currentBatch: 0,
        batchDetails,
      });

      // Create parent document
      const { data: parentDoc, error: parentError } = await supabase
        .from('knowledge_base')
        .insert({
          title: file.name,
          category: `agent_${selectedAgent}`,
          file_path: publicUrl,
          file_type: fileExt,
          content: `Full document: ${totalPages} pages, processed in ${totalBatches} batches`,
        })
        .select()
        .single();

      if (parentError) throw parentError;

      let totalChunksCreated = 0;

      // Process each batch sequentially
      for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
        const startPage = batchNum * PAGES_PER_BATCH + 1;
        const endPage = Math.min((batchNum + 1) * PAGES_PER_BATCH, totalPages);
        
        // Update batch status to processing
        const updatedDetails = [...batchDetails];
        updatedDetails[batchNum].status = 'processing';
        
        setUploadProgress({
          isUploading: true,
          stage: 'processing',
          progress: 10 + Math.floor((batchNum / totalBatches) * 70),
          fileName: file.name,
          totalPages,
          totalBatches,
          currentBatch: batchNum + 1,
          batchDetails: updatedDetails,
        });

        try {
          // Extract text from this batch
          const batchContent = await parsePDFBatch(file, startPage, endPage);
          
          if (batchContent.length < 50) {
            throw new Error(`Batch ${batchNum + 1} extracted only ${batchContent.length} characters`);
          }

          // Store batch document
          const batchTitle = `${file.name} - Pages ${startPage}-${endPage}`;
          const { data: batchDoc, error: batchError } = await supabase
            .from('knowledge_base')
            .insert({
              title: batchTitle,
              category: `agent_${selectedAgent}`,
              parent_document_id: parentDoc.id,
              content: batchContent,
              file_type: 'pdf_batch',
            })
            .select()
            .single();

          if (batchError) throw batchError;

          // Chunk the content client-side (no edge function call - faster and more reliable)
          const chunks = chunkTextClientSide(batchContent);
          console.log(`📦 Created ${chunks.length} chunks for batch ${batchNum + 1}`);

          // Store each chunk directly to database
          for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
            const chunkProgress = ((chunkIndex / chunks.length) * (70 / totalBatches));
            
            setUploadProgress({
              isUploading: true,
              stage: 'processing',
              progress: 10 + Math.floor((batchNum / totalBatches) * 70) + Math.floor(chunkProgress),
              fileName: file.name,
              totalPages,
              totalBatches,
              currentBatch: batchNum + 1,
              batchDetails: updatedDetails,
            });

            const { error: chunkError } = await supabase
              .from('knowledge_base')
              .insert({
                title: `${batchTitle} - Chunk ${chunkIndex + 1}`,
                content: chunks[chunkIndex],
                category: `agent_${selectedAgent}`,
                parent_document_id: batchDoc.id,
                chunk_index: chunkIndex + 1,
                chunk_metadata: {
                  chunk_size: chunks[chunkIndex].length,
                  total_chunks: chunks.length,
                  start_page: startPage,
                  end_page: endPage
                }
              });

            if (chunkError) {
              console.error(`Error creating chunk ${chunkIndex + 1}:`, chunkError);
              throw chunkError;
            }
          }

          const chunksCreated = chunks.length;
          totalChunksCreated += chunksCreated;

          // Mark batch as complete
          updatedDetails[batchNum].status = 'complete';
          updatedDetails[batchNum].chunks = chunksCreated;
          
          setUploadProgress({
            isUploading: true,
            stage: 'processing',
            progress: 10 + Math.floor(((batchNum + 1) / totalBatches) * 70),
            fileName: file.name,
            totalPages,
            totalBatches,
            currentBatch: batchNum + 1,
            batchDetails: updatedDetails,
            chunks: totalChunksCreated,
          });

          console.log(`✅ Batch ${batchNum + 1}/${totalBatches} complete: ${chunksCreated} chunks`);
        } catch (batchError: any) {
          console.error(`❌ Batch ${batchNum + 1} failed:`, batchError);
          
          // Mark batch as failed
          updatedDetails[batchNum].status = 'failed';
          updatedDetails[batchNum].error = batchError.message;
          
          setUploadProgress({
            isUploading: true,
            stage: 'processing',
            progress: 10 + Math.floor(((batchNum + 1) / totalBatches) * 70),
            fileName: file.name,
            totalPages,
            totalBatches,
            currentBatch: batchNum + 1,
            batchDetails: updatedDetails,
            chunks: totalChunksCreated,
          });

          // Continue with next batch instead of failing completely
          toast.error(`Batch ${batchNum + 1} failed. Continuing with remaining batches...`);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["knowledge-base", selectedAgent] });

      const failedBatches = batchDetails.filter(b => b.status === 'failed').length;
      
      setUploadProgress({
        isUploading: true,
        stage: 'complete',
        progress: 100,
        fileName: file.name,
        totalPages,
        totalBatches,
        currentBatch: totalBatches,
        batchDetails,
        chunks: totalChunksCreated,
      });

      setTimeout(() => {
        setUploadProgress({ isUploading: false, stage: 'idle', progress: 0 });
        setSelectedFile(null);
      }, 8000);

      if (failedBatches === 0) {
        toast.success(`✅ All ${totalBatches} batches processed! Created ${totalChunksCreated} searchable chunks from ${totalPages} pages.`);
      } else {
        toast.warning(`⚠️ ${totalBatches - failedBatches} of ${totalBatches} batches succeeded. Created ${totalChunksCreated} chunks. ${failedBatches} batches failed.`);
      }
    } catch (error: any) {
      console.error('Batch processing error:', error);
      throw error;
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedAgent) {
      toast.error("Please select an agent");
      return;
    }
    
    if (!manualContent.title || !manualContent.content) {
      toast.error("Please fill in title and content");
      return;
    }

    addManualDocument.mutate({
      title: manualContent.title,
      category: `agent_${selectedAgent}`,
      content: manualContent.content,
    });
  };

  return (
    <div className="space-y-6">
      <KnowledgeBaseEmbeddings />
      
      <Card>
        <CardHeader>
          <CardTitle>Agent Knowledge Base</CardTitle>
          <CardDescription>
            Upload documents specific to each agent type. Select an agent below to manage their knowledge base.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Agent Selector */}
          <div>
            <Label htmlFor="agent-select">Select Agent</Label>
            <Select value={selectedAgent} onValueChange={setSelectedAgent}>
              <SelectTrigger id="agent-select" className="w-full">
                <SelectValue placeholder="Choose an agent to upload knowledge for..." />
              </SelectTrigger>
              <SelectContent>
                {AGENT_TYPES.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    <div className="flex items-center gap-2">
                      <AgentTypeIcon type={agent.id} className="w-4 h-4" />
                      <span>{agent.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedAgent && (
              <p className="text-xs text-muted-foreground mt-2">
                {AGENT_TYPES.find(a => a.id === selectedAgent)?.description}
              </p>
            )}
          </div>

          {/* Upload Progress Indicator */}
          {uploadProgress.isUploading && (
            <Card className="border-2 border-primary shadow-2xl bg-primary/5 animate-in fade-in-50 duration-500">
              <CardContent className="pt-6 pb-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    {uploadProgress.stage === 'complete' ? (
                      <CheckCircle2 className="w-6 h-6 text-green-500 flex-shrink-0" />
                    ) : uploadProgress.stage === 'error' ? (
                      <AlertCircle className="w-6 h-6 text-destructive flex-shrink-0" />
                    ) : (
                      <Loader2 className="w-6 h-6 text-primary animate-spin flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold">
                        {uploadProgress.stage === 'uploading' && '📤 Uploading File...'}
                        {uploadProgress.stage === 'processing' && uploadProgress.totalBatches && uploadProgress.totalBatches > 1 
                          ? `📕 Processing Large Document (${uploadProgress.totalPages} pages)`
                          : '📄 Extracting Content...'}
                        {uploadProgress.stage === 'chunking' && '✂️ Breaking into Segments...'}
                        {uploadProgress.stage === 'embedding' && '🧠 Generating AI Embeddings...'}
                        {uploadProgress.stage === 'complete' && '✅ Upload Complete!'}
                        {uploadProgress.stage === 'error' && '❌ Upload Failed'}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {uploadProgress.fileName}
                      </p>
                      {uploadProgress.totalBatches && uploadProgress.totalBatches > 1 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Batch {uploadProgress.currentBatch} of {uploadProgress.totalBatches} 
                          {uploadProgress.currentBatch && uploadProgress.batchDetails && (
                            <> (Pages {uploadProgress.batchDetails[uploadProgress.currentBatch - 1]?.startPage}-
                            {uploadProgress.batchDetails[uploadProgress.currentBatch - 1]?.endPage})</>
                          )}
                        </p>
                      )}
                    </div>
                    <span className="text-2xl font-bold text-primary flex-shrink-0">
                      {uploadProgress.progress}%
                    </span>
                  </div>

                  <Progress 
                    value={uploadProgress.progress} 
                    className="h-3"
                    indicatorClassName="bg-gradient-to-r from-primary to-primary/60 transition-all duration-500"
                  />

                  {/* Batch Progress Details */}
                  {uploadProgress.batchDetails && uploadProgress.batchDetails.length > 1 && (
                    <div className="mt-4 space-y-2 max-h-48 overflow-y-auto">
                      {uploadProgress.batchDetails.map((batch) => (
                        <div key={batch.batchNumber} className="flex items-center gap-2 text-xs">
                          {batch.status === 'complete' && (
                            <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                          )}
                          {batch.status === 'processing' && (
                            <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />
                          )}
                          {batch.status === 'failed' && (
                            <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
                          )}
                          {batch.status === 'pending' && (
                            <div className="w-4 h-4 rounded-full border-2 border-muted flex-shrink-0" />
                          )}
                          <span className={batch.status === 'complete' ? 'text-green-600' : batch.status === 'failed' ? 'text-destructive' : 'text-muted-foreground'}>
                            Batch {batch.batchNumber}: Pages {batch.startPage}-{batch.endPage}
                            {batch.status === 'complete' && batch.chunks && ` (${batch.chunks} chunks)`}
                            {batch.status === 'processing' && ' (processing...)'}
                            {batch.status === 'failed' && ' (failed)'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="text-sm">
                    {uploadProgress.stage === 'uploading' && (
                      <p className="text-muted-foreground">Saving file to secure storage...</p>
                    )}
                    {uploadProgress.stage === 'processing' && !uploadProgress.totalBatches && (
                      <p className="text-muted-foreground">Reading and parsing document content...</p>
                    )}
                    {uploadProgress.stage === 'processing' && uploadProgress.totalBatches && uploadProgress.totalBatches > 1 && (
                      <div className="space-y-1">
                        <p className="text-muted-foreground">
                          Processing in {uploadProgress.totalBatches} batches for optimal performance...
                        </p>
                        {uploadProgress.chunks !== undefined && uploadProgress.chunks > 0 && (
                          <p className="text-primary font-semibold">
                            {uploadProgress.chunks} chunks created so far
                          </p>
                        )}
                      </div>
                    )}
                    {uploadProgress.stage === 'chunking' && (
                      <p className="text-muted-foreground">Splitting into searchable segments...</p>
                    )}
                    {uploadProgress.stage === 'embedding' && (
                      <p className="text-muted-foreground">Creating vector embeddings for AI search...</p>
                    )}
                    {uploadProgress.stage === 'complete' && uploadProgress.chunks && (
                      <div className="space-y-1">
                        <p className="text-green-600 font-semibold">
                          Successfully created {uploadProgress.chunks} searchable chunks!
                        </p>
                        {uploadProgress.totalBatches && uploadProgress.totalBatches > 1 && (
                          <p className="text-xs text-muted-foreground">
                            Processed {uploadProgress.totalPages} pages in {uploadProgress.totalBatches} batches
                          </p>
                        )}
                      </div>
                    )}
                    {uploadProgress.stage === 'error' && (
                      <p className="text-destructive font-semibold">
                        {uploadProgress.error || 'An error occurred during upload'}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick File Upload */}
          {selectedAgent && (
            <div className="space-y-3">
              <Label htmlFor="file-upload">Select Document File</Label>
              <div className="flex gap-2">
                <Input
                  id="file-upload"
                  type="file"
                  onChange={handleFileSelect}
                  disabled={uploadProgress.isUploading}
                  accept=".txt,.md,.pdf"
                  className="cursor-pointer"
                />
              </div>
              
              {selectedFile && !uploadProgress.isUploading && (
                <div className="bg-muted p-3 rounded-lg space-y-2">
                  <p className="text-sm font-medium">Selected File:</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      <span className="text-sm">{selectedFile.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({(selectedFile.size / (1024 * 1024)).toFixed(1)} MB)
                      </span>
                    </div>
                    <Button 
                      onClick={handleProcessFile}
                      size="sm"
                      disabled={uploadProgress.isUploading}
                    >
                      Add to Knowledge Base
                    </Button>
                  </div>
                </div>
              )}
              
              <p className="text-xs text-muted-foreground">
                Supported: .txt, .md, .pdf files
              </p>
            </div>
          )}

          {/* Manual Content Entry */}
          {selectedAgent && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Or Add Content Manually</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleManualSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="title">Document Title</Label>
                    <Input
                      id="title"
                      value={manualContent.title}
                      onChange={(e) => setManualContent({ ...manualContent, title: e.target.value })}
                      placeholder="e.g., Product FAQ, Objection Handling Guide"
                    />
                  </div>

                  <div>
                    <Label htmlFor="content">Content</Label>
                    <Textarea
                      id="content"
                      value={manualContent.content}
                      onChange={(e) => setManualContent({ ...manualContent, content: e.target.value })}
                      placeholder="Paste or type document content here..."
                      rows={8}
                    />
                  </div>

                  <Button 
                    type="submit" 
                    disabled={addManualDocument.isPending}
                    className="w-full"
                  >
                    {addManualDocument.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      "Add Document"
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {!selectedAgent && (
            <div className="text-center py-8 text-muted-foreground">
              <p>Select an agent above to start uploading knowledge base documents</p>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedAgent && (
        <Card>
          <CardHeader>
            <CardTitle>
              Knowledge Base Files for {AGENT_TYPES.find(a => a.id === selectedAgent)?.name.split(' - ')[0]}
            </CardTitle>
            <CardDescription>
              {documents?.length || 0} documents uploaded for this agent
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p>Loading...</p>
            ) : documents && documents.length > 0 ? (
              <div className="space-y-2">
                {documents.map((doc) => {
                  const chunkCount = doc.chunks?.[0]?.count || 0;
                  return (
                    <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3 flex-1">
                        <FileText className="w-5 h-5 text-muted-foreground" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <div className="font-medium">{doc.title}</div>
                            {chunkCount > 0 ? (
                              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                                ✓ {chunkCount} chunks
                              </span>
                            ) : (
                              <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
                                Not embedded
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Added {new Date(doc.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteDocument.mutate(doc.id)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                No knowledge base files yet. Upload documents above to enhance this agent's responses.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
