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
import { Trash2, Upload, FileText } from "lucide-react";
import { KnowledgeBaseEmbeddings } from "./KnowledgeBaseEmbeddings";

const CATEGORIES = [
  "Product Info",
  "Objection Handling",
  "Compliance & Legal",
  "Technical Support",
  "Customer Stories",
  "Company History",
  "Style Guide",
];

export const KnowledgeBase = () => {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [content, setContent] = useState("");
  const [uploading, setUploading] = useState(false);

  const { data: documents, isLoading } = useQuery({
    queryKey: ["knowledge-base"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("knowledge_base")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const addDocument = useMutation({
    mutationFn: async (doc: { title: string; category: string; content: string; file_path?: string; file_type?: string }) => {
      const { error } = await supabase
        .from("knowledge_base")
        .insert([doc]);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-base"] });
      setTitle("");
      setCategory("");
      setContent("");
      toast.success("Document added to knowledge base");
    },
    onError: (error) => {
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
      queryClient.invalidateQueries({ queryKey: ["knowledge-base"] });
      toast.success("Document deleted");
    },
    onError: (error) => {
      toast.error("Failed to delete: " + error.message);
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // Handle text-based files
      if (file.type.startsWith("text/") || file.name.endsWith(".txt") || file.name.endsWith(".md")) {
        const text = await file.text();
        setContent(text);
        setTitle(file.name);
        toast.success("File content loaded");
      } 
      // Handle PDF files
      else if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
        toast.info("Processing PDF... This may take a moment.");
        
        // Upload PDF to storage first
        const filePath = `knowledge-base/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("knowledge-base")
          .upload(filePath, file);
        
        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from("knowledge-base")
          .getPublicUrl(filePath);

        // Parse PDF content using Supabase edge function
        const { data: parseData, error: parseError } = await supabase.functions.invoke("parse-pdf", {
          body: { filePath }
        });

        if (parseError) throw parseError;

        setContent(parseData.content || "");
        setTitle(file.name.replace(".pdf", ""));
        toast.success("PDF parsed successfully!");
      } 
      else {
        toast.error("Only text files (.txt, .md) and PDFs are supported");
      }
    } catch (error: any) {
      toast.error("Failed to process file: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !category || !content) {
      toast.error("Please fill in all fields");
      return;
    }

    addDocument.mutate({
      title,
      category,
      content,
    });
  };

  return (
    <div className="space-y-6">
      <KnowledgeBaseEmbeddings />
      
      <Card>
        <CardHeader>
          <CardTitle>Knowledge Base</CardTitle>
          <CardDescription>
            Upload documents for AI agents to reference (products, services, company history, objections, etc.)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="file-upload">Upload Document (Optional)</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  id="file-upload"
                  type="file"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  accept=".txt,.md,.pdf"
                  className="cursor-pointer"
                />
                <Button type="button" size="icon" disabled={uploading}>
                  <Upload className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Supported: .txt, .md, .pdf files
              </p>
            </div>

            <div>
              <Label htmlFor="title">Document Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Algo V5 Product Guide"
              />
            </div>

            <div>
              <Label htmlFor="category">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="content">Content</Label>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Paste or type document content here..."
                rows={8}
              />
            </div>

            <Button type="submit" disabled={addDocument.isPending}>
              {addDocument.isPending ? "Adding..." : "Add to Knowledge Base"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Existing Documents</CardTitle>
          <CardDescription>
            {documents?.length || 0} documents in knowledge base
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Loading...</p>
          ) : documents && documents.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      {doc.title}
                    </TableCell>
                    <TableCell>{doc.category}</TableCell>
                    <TableCell>
                      {new Date(doc.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteDocument.mutate(doc.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground">No documents yet. Add your first document above.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
