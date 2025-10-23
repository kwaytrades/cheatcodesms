import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export const CSVImportDialog = ({ onImportComplete }: { onImportComplete?: () => void }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [file, setFile] = useState<File | null>(null);

  const parseCSV = (text: string): string[][] => {
    const lines = text.split('\n').filter(line => line.trim());
    return lines.map(line => {
      const values: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());
      return values;
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
        toast.error("Please select a CSV file");
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleImport = async () => {
    if (!file) {
      toast.error("Please select a file");
      return;
    }

    setLoading(true);
    setProgress(0);

    try {
      // Read file
      const text = await file.text();
      const rows = parseCSV(text);
      
      if (rows.length < 2) {
        toast.error("CSV file must have at least a header row and one data row");
        return;
      }

      const headers = rows[0].map(h => h.toLowerCase().trim());
      const dataRows = rows.slice(1);

      // Use AI to map columns intelligently
      const { data: mappingData, error: mappingError } = await supabase.functions.invoke('map-csv-columns', {
        body: { headers, sampleRow: dataRows[0] }
      });

      if (mappingError) throw mappingError;

      const columnMapping = mappingData.mapping;

      // Process contacts in batches
      const batchSize = 50;
      let imported = 0;
      let failed = 0;

      for (let i = 0; i < dataRows.length; i += batchSize) {
        const batch = dataRows.slice(i, i + batchSize);
        
        const contacts = batch.map(row => {
          const contact: any = {};
          
          headers.forEach((header, index) => {
            const mappedField = columnMapping[header];
            const value = row[index]?.trim();
            
            if (mappedField && value) {
              if (mappedField === 'tags' || mappedField === 'products_owned') {
                // Parse array fields
                contact[mappedField] = value.split(/[,;|]/).map((v: string) => v.trim()).filter(Boolean);
              } else if (mappedField === 'lead_score' || mappedField === 'engagement_score' || mappedField === 'total_spent') {
                // Parse numeric fields
                contact[mappedField] = parseFloat(value) || null;
              } else {
                contact[mappedField] = value;
              }
            }
          });

          // Set defaults
          if (!contact.lead_status) contact.lead_status = 'new';
          if (!contact.full_name && (contact.first_name || contact.last_name)) {
            contact.full_name = `${contact.first_name || ''} ${contact.last_name || ''}`.trim();
          }

          return contact;
        });

        // Insert batch
        const { data, error } = await supabase
          .from('contacts')
          .insert(contacts)
          .select();

        if (error) {
          console.error("Batch insert error:", error);
          failed += batch.length;
        } else {
          imported += data?.length || 0;
        }

        setProgress(Math.round(((i + batch.length) / dataRows.length) * 100));
      }

      toast.success(`Import complete! Imported: ${imported}, Failed: ${failed}`);
      setOpen(false);
      setFile(null);
      setProgress(0);
      
      if (onImportComplete) {
        onImportComplete();
      }
    } catch (error: any) {
      console.error("Error importing CSV:", error);
      toast.error("Failed to import contacts");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Upload className="h-4 w-4" />
          <span className="hidden sm:inline">Import CSV</span>
          <span className="sm:hidden">Import</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Import Contacts from CSV</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="csv-file">Select CSV File</Label>
            <Input
              id="csv-file"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              AI will automatically map columns to contact fields including products, tags, and more
            </p>
          </div>

          {file && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(2)} KB</p>
            </div>
          )}

          {loading && (
            <div className="space-y-2">
              <Progress value={progress} />
              <p className="text-xs text-center text-muted-foreground">{progress}% complete</p>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={loading || !file}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                "Import"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
