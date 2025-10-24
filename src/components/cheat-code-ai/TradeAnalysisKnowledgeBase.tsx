import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Upload, Trash2, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

const DOCUMENT_TYPES = [
  { value: "stock_education", label: "Stock Education" },
  { value: "market_data_guide", label: "Market Data Guide" },
  { value: "setup_types", label: "Setup Types" },
  { value: "risk_management", label: "Risk Management" },
  { value: "sector_analysis", label: "Sector Analysis" },
  { value: "faq", label: "FAQ" },
  { value: "general", label: "General" },
];

export const TradeAnalysisKnowledgeBase = () => {
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState("stock_education");
  const [isUploading, setIsUploading] = useState(false);
  const queryClient = useQueryClient();

  const { data: documents, isLoading } = useQuery({
    queryKey: ["trade-analysis-kb"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("knowledge_base")
        .select("*")
        .eq("category", "agent_trade_analysis")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("knowledge_base")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trade-analysis-kb"] });
      toast.success("Document deleted successfully");
    },
    onError: (error) => {
      toast.error(`Failed to delete document: ${error.message}`);
    },
  });

  const handleUpload = async () => {
    if (!file) {
      toast.error("Please select a file");
      return;
    }

    setIsUploading(true);

    try {
      const fileName = `${Date.now()}-${file.name}`;
      const filePath = `knowledge-base/${fileName}`;

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from("knowledge-base")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("knowledge-base")
        .getPublicUrl(filePath);

      // Process the document
      const { error: processError } = await supabase.functions.invoke("chunk-and-embed-pdf", {
        body: {
          filePath: publicUrl,
          title: file.name,
          category: "agent_trade_analysis",
          fileType: documentType,
        },
      });

      if (processError) throw processError;

      toast.success("Document uploaded and processing started");
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ["trade-analysis-kb"] });
    } catch (error: any) {
      toast.error(`Upload failed: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Group documents by parent to show chunk counts
  const groupedDocs = documents?.reduce((acc, doc) => {
    const parentId = doc.parent_document_id || doc.id;
    if (!acc[parentId]) {
      acc[parentId] = {
        main: doc.parent_document_id ? null : doc,
        chunks: [],
      };
    }
    if (doc.parent_document_id) {
      acc[parentId].chunks.push(doc);
    } else if (!acc[parentId].main) {
      acc[parentId].main = doc;
    }
    return acc;
  }, {} as Record<string, { main: any; chunks: any[] }>);

  const uniqueDocuments = groupedDocs
    ? Object.values(groupedDocs).map((group) => ({
        ...(group.main || group.chunks[0]),
        chunkCount: group.chunks.length || 1,
      }))
    : [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload Trading Knowledge</CardTitle>
          <CardDescription>
            Add educational content, trading guides, and technical analysis resources for the agent
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="docType">Document Type</Label>
              <Select value={documentType} onValueChange={setDocumentType}>
                <SelectTrigger id="docType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="file">Upload Document (PDF or Text)</Label>
              <Input
                id="file"
                type="file"
                accept=".pdf,.txt,.md"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>

            <Button onClick={handleUpload} disabled={isUploading || !file}>
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload & Process
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Knowledge Base Documents</CardTitle>
          <CardDescription>
            {uniqueDocuments?.length || 0} documents | {documents?.length || 0} total chunks
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : uniqueDocuments?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No knowledge base documents yet</p>
              <p className="text-sm mt-2">Upload your first trading guide above</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Chunks</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {uniqueDocuments?.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">{doc.title}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{doc.file_type || "general"}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge>{doc.chunkCount}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(doc.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteMutation.mutate(doc.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
