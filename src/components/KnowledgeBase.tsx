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
  }>({
    isUploading: false,
    stage: 'idle',
    progress: 0
  });

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
      
      const { data: chunkData, error: chunkError } = await supabase.functions.invoke(
        "chunk-and-embed-pdf",
        {
          body: {
            document_id: data.id,
            content: doc.content,
            title: doc.title,
            category: doc.category,
          },
        }
      );

      if (chunkError) {
        throw chunkError;
      }

      const chunksCreated = chunkData?.chunks_created || 0;
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

    setSelectedFile(file);
    toast.success(`File "${file.name}" selected. Click "Add to Knowledge Base" to process.`);
  };

  const handleProcessFile = async () => {
    if (!selectedFile) return;

    try {
      setUploadProgress({ isUploading: true, stage: 'uploading', progress: 10, fileName: selectedFile.name });
      
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${selectedAgent}_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('knowledge-base')
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('knowledge-base')
        .getPublicUrl(filePath);

      setUploadProgress({ isUploading: true, stage: 'processing', progress: 40, fileName: selectedFile.name });

      let content = '';
      
      if (fileExt?.toLowerCase() === 'pdf') {
        console.log('Parsing PDF:', filePath);
        const { data: pdfData, error: parseError } = await supabase.functions.invoke('parse-pdf', {
          body: { filePath: filePath }
        });
        
        console.log('PDF parse result:', { data: pdfData, error: parseError });
        
        if (parseError) {
          throw new Error('Failed to parse PDF: ' + parseError.message);
        }
        
        if (!pdfData?.text && !pdfData?.content) {
          throw new Error('PDF parsing returned no text content');
        }
        
        content = pdfData.text || pdfData.content;
        
        if (content.length < 100) {
          throw new Error(`PDF extracted only ${content.length} characters. The PDF may be image-based, encrypted, or corrupted. Try converting to text first.`);
        }
        
        console.log('Extracted PDF content:', content.length, 'characters');
      } else if (['txt', 'md', 'text'].includes(fileExt?.toLowerCase() || '')) {
        content = await selectedFile.text();
      }

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

      setUploadProgress({ isUploading: true, stage: 'chunking', progress: 65, fileName: selectedFile.name });

      const { data: chunkData, error: chunkError } = await supabase.functions.invoke(
        'chunk-and-embed-pdf',
        {
          body: {
            document_id: kbEntry.id,
            content: content,
            title: selectedFile.name,
            category: `agent_${selectedAgent}`,
          },
        }
      );

      if (chunkError) {
        console.error('Chunking error:', chunkError);
        throw new Error(chunkError.message || 'Failed to chunk document');
      }

      queryClient.invalidateQueries({ queryKey: ["knowledge-base", selectedAgent] });
      
      setUploadProgress({ 
        isUploading: true, 
        stage: 'complete', 
        progress: 100, 
        chunks: chunkData?.chunks_created || 0,
        fileName: selectedFile.name
      });
      
      setTimeout(() => {
        setUploadProgress({ isUploading: false, stage: 'idle', progress: 0 });
        setSelectedFile(null);
      }, 5000);
      
      toast.success(`File processed into ${chunkData?.chunks_created || 0} searchable chunks`);
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
                        {uploadProgress.stage === 'processing' && '📄 Extracting Content...'}
                        {uploadProgress.stage === 'chunking' && '✂️ Breaking into Segments...'}
                        {uploadProgress.stage === 'embedding' && '🧠 Generating AI Embeddings...'}
                        {uploadProgress.stage === 'complete' && '✅ Upload Complete!'}
                        {uploadProgress.stage === 'error' && '❌ Upload Failed'}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {uploadProgress.fileName}
                      </p>
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

                  <div className="text-sm">
                    {uploadProgress.stage === 'uploading' && (
                      <p className="text-muted-foreground">Saving file to secure storage...</p>
                    )}
                    {uploadProgress.stage === 'processing' && (
                      <p className="text-muted-foreground">Reading and parsing document content...</p>
                    )}
                    {uploadProgress.stage === 'chunking' && (
                      <p className="text-muted-foreground">Splitting into searchable segments...</p>
                    )}
                    {uploadProgress.stage === 'embedding' && (
                      <p className="text-muted-foreground">Creating vector embeddings for AI search...</p>
                    )}
                    {uploadProgress.stage === 'complete' && uploadProgress.chunks && (
                      <p className="text-green-600 font-semibold">
                        Successfully created {uploadProgress.chunks} searchable chunks!
                      </p>
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
                        ({(selectedFile.size / 1024).toFixed(1)} KB)
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
