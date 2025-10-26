import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TrendingUp } from "lucide-react";
import { useState } from "react";

export const RecalculateScoresButton = () => {
  const [loading, setLoading] = useState(false);

  const handleRecalculate = async () => {
    try {
      setLoading(true);
      toast.info("Starting score recalculation...");

      // Get ALL contact IDs to force full recalculation
      const { data: contacts, error: fetchError } = await supabase
        .from('contacts')
        .select('id');

      if (fetchError) throw fetchError;

      if (!contacts || contacts.length === 0) {
        toast.info("No contacts found!");
        return;
      }

      const contactIds = contacts.map(c => c.id);
      
      // Call the batch calculation function
      const { data, error } = await supabase.functions.invoke('calculate-scores-batch', {
        body: { contactIds }
      });

      if (error) throw error;

      toast.success(`Score calculation started for ${contactIds.length} contacts!`);
      toast.info("Scores will be updated in the background. Refresh the page in a few moments.");
      
    } catch (error: any) {
      console.error("Error recalculating scores:", error);
      toast.error(error.message || "Failed to recalculate scores");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleRecalculate}
      disabled={loading}
      className="gap-2"
    >
      <TrendingUp className="h-4 w-4" />
      {loading ? "Calculating..." : "Recalculate Scores"}
    </Button>
  );
};
