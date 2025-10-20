import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Zap } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export function KnowledgeBaseEmbeddings() {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);

  // Get count of documents without embeddings
  const { data: stats } = useQuery({
    queryKey: ["knowledge-base-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("knowledge_base")
        .select("id, content");
      
      if (error) throw error;
      
      const total = data.length;
      // We'll count documents that need embeddings after vector search is set up
      const withEmbeddings = 0;
      const withoutEmbeddings = total;
      
      return { total, withEmbeddings, withoutEmbeddings };
    },
  });

  const generateEmbeddings = useMutation({
    mutationFn: async () => {
      setIsGenerating(true);
      setProgress(0);

      // Get all documents that need embeddings
      const { data: documents, error } = await supabase
        .from("knowledge_base")
        .select("id, content");

      if (error) throw error;
      if (!documents || documents.length === 0) {
        throw new Error("No documents need embeddings");
      }

      console.log(`Generating embeddings for ${documents.length} documents`);

      // Generate embeddings for each document
      const total = documents.length;
      let completed = 0;

      for (const doc of documents) {
        if (!doc.content) {
          completed++;
          setProgress((completed / total) * 100);
          continue;
        }

        const { error: embeddingError } = await supabase.functions.invoke(
          "generate-embeddings",
          {
            body: {
              documentId: doc.id,
              content: doc.content,
            },
          }
        );

        if (embeddingError) {
          console.error(`Failed to generate embedding for ${doc.id}:`, embeddingError);
        }

        completed++;
        setProgress((completed / total) * 100);
      }

      return { processed: completed };
    },
    onSuccess: (data) => {
      toast.success(`Generated embeddings for ${data.processed} documents`);
      queryClient.invalidateQueries({ queryKey: ["knowledge-base-stats"] });
      setIsGenerating(false);
      setProgress(0);
    },
    onError: (error: Error) => {
      toast.error(`Failed to generate embeddings: ${error.message}`);
      setIsGenerating(false);
      setProgress(0);
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Vector Search Embeddings
        </CardTitle>
        <CardDescription>
          Generate semantic embeddings for knowledge base documents to enable AI-powered similarity search
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {stats && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Total Documents:</span>
              <span className="font-medium">{stats.total}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>With Embeddings:</span>
              <span className="font-medium text-green-600">{stats.withEmbeddings}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Need Embeddings:</span>
              <span className="font-medium text-orange-600">{stats.withoutEmbeddings}</span>
            </div>
          </div>
        )}

        {isGenerating && (
          <div className="space-y-2">
            <Progress value={progress} />
            <p className="text-sm text-muted-foreground text-center">
              Generating embeddings... {Math.round(progress)}%
            </p>
          </div>
        )}

        <Button
          onClick={() => generateEmbeddings.mutate()}
          disabled={isGenerating || stats?.withoutEmbeddings === 0}
          className="w-full"
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Zap className="mr-2 h-4 w-4" />
              Generate Embeddings for {stats?.withoutEmbeddings || 0} Documents
            </>
          )}
        </Button>

        {stats?.withoutEmbeddings === 0 && (
          <p className="text-sm text-green-600 text-center">
            ✓ All documents have embeddings
          </p>
        )}
      </CardContent>
    </Card>
  );
}
