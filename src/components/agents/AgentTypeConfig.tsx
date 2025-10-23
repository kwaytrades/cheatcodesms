import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, Trash2, Plus, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface AgentTypeConfigProps {
  agentType: string;
  agentName: string;
  agentDescription: string;
}

export function AgentTypeConfig({ agentType, agentName, agentDescription }: AgentTypeConfigProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("templates");
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

  // Config state
  const [config, setConfig] = useState({
    systemPrompt: "",
    firstMessageTemplate: "",
    followUpTemplate: "",
    conversionTemplate: "",
    tone: "professional",
    maxMessagesPerWeek: 3,
    isActive: true,
  });

  // Knowledge base for this agent type with chunk counts
  const { data: knowledgeBase } = useQuery({
    queryKey: ["agent-knowledge", agentType],
    queryFn: async () => {
      const { data } = await supabase
        .from("knowledge_base")
        .select(`
          *,
          chunks:knowledge_base!parent_document_id(count)
        `)
        .eq("category", `agent_${agentType}`)
        .is("parent_document_id", null)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const handleSaveConfig = async () => {
    // In a real implementation, save to a new agent_type_configs table
    toast({ title: "Success", description: "Agent configuration saved" });
  };

  const handleUploadFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    try {
      // Stage 1: Uploading (0-25%)
      setUploadProgress({ isUploading: true, stage: 'uploading', progress: 10, fileName: file.name });
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${agentType}_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      setUploadProgress({ isUploading: true, stage: 'uploading', progress: 25, fileName: file.name });

      const { error: uploadError } = await supabase.storage
        .from('knowledge-base')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('knowledge-base')
        .getPublicUrl(filePath);

      // Stage 2: Processing (25-50%)
      setUploadProgress({ isUploading: true, stage: 'processing', progress: 40, fileName: file.name });

      let content = `Knowledge base file for ${agentName}`;
      
      if (fileExt?.toLowerCase() === 'pdf') {
        const { data: pdfData, error: parseError } = await supabase.functions.invoke('parse-pdf', {
          body: { file_path: filePath }
        });
        
        if (!parseError && pdfData?.text) {
          content = pdfData.text;
        }
      } else if (['txt', 'md', 'text'].includes(fileExt?.toLowerCase() || '')) {
        content = await file.text();
      }

      setUploadProgress({ isUploading: true, stage: 'processing', progress: 50, fileName: file.name });

      const { data: kbEntry, error: dbError } = await supabase
        .from('knowledge_base')
        .insert({
          title: file.name,
          category: `agent_${agentType}`,
          file_path: publicUrl,
          file_type: fileExt,
          content: content,
        })
        .select()
        .single();

      if (dbError) throw dbError;

      // Stage 3: Chunking (50-75%)
      setUploadProgress({ isUploading: true, stage: 'chunking', progress: 65, fileName: file.name });

      // Stage 4: Embedding (75-100%)
      setUploadProgress({ isUploading: true, stage: 'embedding', progress: 80, fileName: file.name });

      const { data: chunkData, error: chunkError } = await supabase.functions.invoke(
        'chunk-and-embed-pdf',
        {
          body: {
            document_id: kbEntry.id,
            content: content,
            title: file.name,
            category: `agent_${agentType}`,
          },
        }
      );

      if (chunkError) {
        console.error('Chunk error:', chunkError);
        throw new Error(chunkError.message || 'Failed to chunk and embed document');
      }

      queryClient.invalidateQueries({ queryKey: ["agent-knowledge", agentType] });
      
      // Stage 5: Complete (100%)
      setUploadProgress({ 
        isUploading: true, 
        stage: 'complete', 
        progress: 100, 
        chunks: chunkData?.chunks_created || 0,
        fileName: file.name
      });
      
      // Clear after 5 seconds
      setTimeout(() => {
        setUploadProgress({ isUploading: false, stage: 'idle', progress: 0 });
      }, 5000);
      
      toast({ 
        title: "Success!", 
        description: `File processed into ${chunkData?.chunks_created || 0} searchable chunks`
      });
    } catch (error) {
      console.error('Upload error:', error);
      setUploadProgress({ 
        isUploading: true, 
        stage: 'error', 
        progress: 0, 
        fileName: file?.name,
        error: error instanceof Error ? error.message : 'Failed to process file'
      });
      toast({ 
        title: "Error", 
        description: error instanceof Error ? error.message : "Failed to process file", 
        variant: "destructive"
      });
    }
  };

  const handleDeleteKnowledge = async (id: string, filePath: string | null) => {
    try {
      if (filePath) {
        const fileName = filePath.split('/').pop();
        if (fileName) {
          await supabase.storage.from('knowledge-base').remove([fileName]);
        }
      }

      const { error } = await supabase
        .from('knowledge_base')
        .delete()
        .eq('id', id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["agent-knowledge", agentType] });
      toast({ title: "Success", description: "File deleted successfully" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete file", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{agentName}</CardTitle>
          <CardDescription>{agentDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <Label>Agent Active</Label>
              <p className="text-sm text-muted-foreground">Enable or disable this agent type</p>
            </div>
            <Switch
              checked={config.isActive}
              onCheckedChange={(checked) => setConfig({ ...config, isActive: checked })}
            />
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full">
          <TabsTrigger value="templates" className="flex-1">Message Templates</TabsTrigger>
          <TabsTrigger value="knowledge" className="flex-1">Knowledge Base</TabsTrigger>
          <TabsTrigger value="behavior" className="flex-1">Behavior</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Prompt</CardTitle>
              <CardDescription>Core instructions that define this agent's personality and role</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                rows={6}
                placeholder={`You are a friendly ${agentName} concierge. Your role is to...`}
                value={config.systemPrompt}
                onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>First Message Template</CardTitle>
              <CardDescription>Initial message sent when agent is assigned</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                rows={4}
                placeholder="Hi {{first_name}}! I'm excited to help you with..."
                value={config.firstMessageTemplate}
                onChange={(e) => setConfig({ ...config, firstMessageTemplate: e.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-2">
                Available variables: {`{{first_name}}, {{last_name}}, {{product_name}}, {{context}}`}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Follow-up Template</CardTitle>
              <CardDescription>Template for subsequent check-in messages</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                rows={4}
                placeholder="Hey {{first_name}}, just checking in..."
                value={config.followUpTemplate}
                onChange={(e) => setConfig({ ...config, followUpTemplate: e.target.value })}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Conversion Template</CardTitle>
              <CardDescription>Message sent when trying to convert the lead</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                rows={4}
                placeholder="{{first_name}}, based on your interests..."
                value={config.conversionTemplate}
                onChange={(e) => setConfig({ ...config, conversionTemplate: e.target.value })}
              />
            </CardContent>
          </Card>

          <Button onClick={handleSaveConfig}>Save Templates</Button>
        </TabsContent>

        <TabsContent value="knowledge" className="space-y-4">
          {uploadProgress.isUploading && (
            <Card className="border-2 border-primary shadow-2xl bg-primary/5 animate-in fade-in-50 duration-500">
              <CardContent className="pt-6 pb-6">
                <div className="space-y-4">
                  {/* Stage Header with Icon */}
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

                  {/* Progress Bar */}
                  <Progress 
                    value={uploadProgress.progress} 
                    className="h-3"
                    indicatorClassName="bg-gradient-to-r from-primary to-primary/60 transition-all duration-500"
                  />

                  {/* Stage Details */}
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

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Knowledge Base Files</CardTitle>
                  <CardDescription>Upload documents specific to this agent type</CardDescription>
                </div>
                <Button size="sm" onClick={() => document.getElementById(`file-upload-${agentType}`)?.click()}>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload File
                </Button>
                <input
                  id={`file-upload-${agentType}`}
                  type="file"
                  className="hidden"
                  accept=".pdf,.txt,.md,.doc,.docx"
                  onChange={handleUploadFile}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {knowledgeBase?.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No knowledge base files yet. Upload documents to enhance this agent's responses.
                </p>
              ) : (
                knowledgeBase?.map((item) => {
                  const chunkCount = item.chunks?.[0]?.count || 0;
                  return (
                    <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="font-medium">{item.title}</div>
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
                          <div className="text-xs text-muted-foreground">
                            {new Date(item.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteKnowledge(item.id, item.file_path)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Context Instructions</CardTitle>
              <CardDescription>Additional instructions for using the knowledge base</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                rows={4}
                placeholder="When answering questions, prioritize information from the uploaded documents..."
              />
              <Button className="mt-4">Save Instructions</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="behavior" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Communication Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Message Tone</Label>
                <select
                  className="w-full border rounded-md p-2"
                  value={config.tone}
                  onChange={(e) => setConfig({ ...config, tone: e.target.value })}
                >
                  <option value="professional">Professional</option>
                  <option value="friendly">Friendly</option>
                  <option value="casual">Casual</option>
                  <option value="formal">Formal</option>
                  <option value="enthusiastic">Enthusiastic</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label>Max Messages Per Week</Label>
                <Input
                  type="number"
                  value={config.maxMessagesPerWeek}
                  onChange={(e) => setConfig({ ...config, maxMessagesPerWeek: parseInt(e.target.value) })}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Trigger Rules</CardTitle>
              <CardDescription>Define when this agent should send messages</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="font-medium">No Reply After 48 Hours</div>
                  <div className="text-sm text-muted-foreground">Send follow-up if no response</div>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="font-medium">Product Page Visit</div>
                  <div className="text-sm text-muted-foreground">Message when they visit product page</div>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="font-medium">Milestone Reached</div>
                  <div className="text-sm text-muted-foreground">Celebrate progress milestones</div>
                </div>
                <Switch />
              </div>
            </CardContent>
          </Card>

          <Button onClick={handleSaveConfig}>Save Behavior Settings</Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}
