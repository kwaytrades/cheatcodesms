import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Search } from "lucide-react";

export function KnowledgeBaseEmbeddings() {
  const { data: stats } = useQuery({
    queryKey: ["knowledge-base-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("knowledge_base")
        .select("*");
      
      if (error) throw error;
      
      const total = data.length;
      const chunked = data.filter((doc: any) => doc.parent_document_id !== null).length;
      
      return { total, chunked };
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          AI-Powered Search
        </CardTitle>
        <CardDescription>
          Your knowledge base uses full-text search combined with semantic chunking for accurate results
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
              <span>Searchable Chunks:</span>
              <span className="font-medium text-green-600">{stats.chunked}</span>
            </div>
          </div>
        )}

        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm text-blue-900 dark:text-blue-100">
            <strong>✓ Search is Active</strong><br/>
            Documents are automatically chunked into searchable segments. The AI uses full-text search with context-aware ranking to find relevant information.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
