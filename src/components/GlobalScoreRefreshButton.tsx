import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { useState } from "react";

export const GlobalScoreRefreshButton = () => {
  const [loading, setLoading] = useState(false);

  const handleGlobalRefresh = async () => {
    try {
      setLoading(true);
      toast.info("Starting global score refresh for all active contacts...");

      const { data, error } = await supabase.functions.invoke('recalculate-all-scores', {
        body: { limit: 50000 }
      });

      if (error) throw error;

      toast.success(`Refreshed ${data.succeeded} of ${data.processed} contact scores!`);
      
      if (data.failed > 0) {
        toast.warning(`${data.failed} contacts failed to update. Check logs for details.`);
      }
      
    } catch (error: any) {
      console.error("Error refreshing scores:", error);
      toast.error(error.message || "Failed to refresh scores");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleGlobalRefresh}
      disabled={loading}
      className="gap-2"
    >
      <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
      {loading ? "Refreshing..." : "Refresh All Scores"}
    </Button>
  );
};
