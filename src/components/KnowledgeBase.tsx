import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Trash2, Upload, FileText, Download } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";

const CATEGORIES = [
  "Product Info",
  "Objection Handling",
  "Compliance & Legal",
  "Technical Support",
  "Customer Stories",
  "Company History",
];

export function KnowledgeBase() {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const queryClient = useQueryClient();

  const { data: knowledgeBase = [], isLoading } = useQuery({
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

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!title || !category) {
        throw new Error("Title and category are required");
      }

      let filePath = null;
      let fileType = null;

      // Upload file if provided
      if (file) {
        const fileExt = file.name.split(".").pop();
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        filePath = fileName;
        fileType = file.type;

        const { error: uploadError } = await supabase.storage
          .from("knowledge-base")
          .upload(fileName, file);

        if (uploadError) throw uploadError;
      }

      // Insert knowledge base entry
      const { error } = await supabase.from("knowledge_base").insert({
        title,
        category,
        content,
        file_path: filePath,
        file_type: fileType,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-base"] });
      toast.success("Document added to knowledge base");
      setTitle("");
      setCategory("");
      setContent("");
      setFile(null);
    },
    onError: (error) => {
      toast.error("Failed to add document: " + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const doc = knowledgeBase.find((d) => d.id === id);

      // Delete file from storage if exists
      if (doc?.file_path) {
        await supabase.storage.from("knowledge-base").remove([doc.file_path]);
      }

      // Delete database entry
      const { error } = await supabase.from("knowledge_base").delete().eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-base"] });
      toast.success("Document removed");
    },
    onError: (error) => {
      toast.error("Failed to remove document: " + error.message);
    },
  });

  const downloadFile = async (filePath: string, title: string) => {
    const { data, error } = await supabase.storage
      .from("knowledge-base")
      .download(filePath);

    if (error) {
      toast.error("Failed to download file");
      return;
    }

    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = title;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Add Knowledge Base Document</CardTitle>
          <CardDescription>
            Upload documents or add text that AI agents can reference during conversations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="e.g., Algo V5 Product Guide"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
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

          <div className="space-y-2">
            <Label htmlFor="content">Text Content (Optional)</Label>
            <Textarea
              id="content"
              placeholder="Paste document text here..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="file">Upload File (Optional)</Label>
            <div className="flex gap-2">
              <Input
                id="file"
                type="file"
                accept=".pdf,.doc,.docx,.txt,.md"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>
            {file && (
              <p className="text-sm text-muted-foreground">
                Selected: {file.name}
              </p>
            )}
          </div>

          <Button
            onClick={() => uploadMutation.mutate()}
            disabled={uploadMutation.isPending || !title || !category}
          >
            <Upload className="h-4 w-4 mr-2" />
            Add Document
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Knowledge Base Documents</CardTitle>
          <CardDescription>
            {knowledgeBase.length} document(s) available to AI agents
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Loading...</p>
          ) : knowledgeBase.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No documents added yet
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {knowledgeBase.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">{doc.title}</TableCell>
                    <TableCell>{doc.category}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        {doc.file_path ? "File" : "Text"}
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(doc.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {doc.file_path && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => downloadFile(doc.file_path, doc.title)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteMutation.mutate(doc.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
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
}
