import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Loader2, Download } from "lucide-react";
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

  const downloadInfluencerTemplate = () => {
    const csv = `Name,Email,Phone,Platform,Handle,Followers,Engagement Rate,Niche,Tier
John Doe,john@example.com,+1234567890,tiktok,@johndoe,50000,5.2,fitness|tech,micro
Jane Smith,jane@example.com,+1987654321,youtube,@janesmith,120000,4.8,beauty|lifestyle,mid
Mike Johnson,mike@example.com,+1555123456,instagram,@mikej,85000,6.1,travel|food,micro`;
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'influencer_import_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success("Template downloaded");
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
      console.log("Column Mapping:", columnMapping);
      console.log("Sample data row:", dataRows[0]);

      // Process contacts in batches
      const batchSize = 50;
      let imported = 0;
      let failed = 0;
      const importedContactIds: string[] = [];

      for (let i = 0; i < dataRows.length; i += batchSize) {
        const batch = dataRows.slice(i, i + batchSize);
        
        const contacts = batch.map(row => {
          const contact: any = {};
          
          headers.forEach((header, index) => {
            const mappedField = columnMapping[header];
            const value = row[index]?.trim();
            
            if (mappedField && value) {
              // Handle array fields (semicolon, comma, or pipe separated)
              if (mappedField === 'tags' || mappedField === 'products_owned' || mappedField === 'products_interested') {
                contact[mappedField] = value.split(/[,;|]/).map((v: string) => v.trim()).filter(Boolean);
              } 
              // Handle currency fields (remove $ and commas)
              else if (mappedField === 'total_spent' || mappedField === 'disputed_amount') {
                const cleaned = value.replace(/[$,]/g, '');
                contact[mappedField] = parseFloat(cleaned) || null;
              }
              // Handle boolean fields
              else if (mappedField === 'has_disputed') {
                contact[mappedField] = value.toLowerCase() === 'true' || parseFloat(value.replace(/[$,]/g, '')) > 0;
              }
              // Handle numeric fields
              else if (mappedField === 'lead_score' || mappedField === 'engagement_score' || mappedField === 'likelihood_to_buy_score' || mappedField === 'follower_count' || mappedField === 'avg_views') {
                contact[mappedField] = parseFloat(value) || null;
              }
              // Handle decimal fields for influencers
              else if (mappedField === 'engagement_rate') {
                contact[mappedField] = parseFloat(value) || null;
              }
              // Handle influencer tier
              else if (mappedField === 'influencer_tier') {
                const tierMap: Record<string, string> = {
                  'nano': 'nano',
                  'micro': 'micro',
                  'mid': 'mid',
                  'macro': 'macro',
                  'mega': 'mega'
                };
                contact.influencer_tier = tierMap[value.toLowerCase()] || value;
              }
              // Handle platform field
              else if (mappedField === 'platform') {
                const platformMap: Record<string, string> = {
                  'tiktok': 'tiktok',
                  'youtube': 'youtube',
                  'instagram': 'instagram',
                  'blog': 'blog',
                  'twitter': 'twitter',
                  'news': 'news'
                };
                contact.platform = platformMap[value.toLowerCase()] || value.toLowerCase();
              }
              // Handle array fields (niche_categories, content_topics)
              else if (mappedField === 'niche_categories' || mappedField === 'content_topics') {
                contact[mappedField] = value.split(/[,;|]/).map((v: string) => v.trim()).filter(Boolean);
              }
              // Handle JSONB array fields
              else if (mappedField === 'webinar_attendance' || mappedField === 'form_submissions' || mappedField === 'quiz_responses') {
                // Parse as array
                const items = value.split(/[,;|]/).map((v: string) => v.trim()).filter(Boolean);
                contact[mappedField] = items.length > 0 ? items : [];
              }
              // Handle customer_tier and derive lead_status
              else if (mappedField === 'customer_tier') {
                contact.customer_tier = value;
                // Derive lead_status from customer_tier
                const tierUpper = value.toUpperCase();
                if (tierUpper === 'VIP' || tierUpper.includes('LEVEL 3')) {
                  contact.lead_status = 'hot';
                } else if (tierUpper.includes('LEVEL 2')) {
                  contact.lead_status = 'warm';
                } else if (tierUpper.includes('LEVEL 1')) {
                  contact.lead_status = 'warm';
                } else if (tierUpper === 'LEAD') {
                  contact.lead_status = 'cold';
                } else if (tierUpper === 'SHITLIST') {
                  contact.lead_status = 'cold';
                } else {
                  contact.lead_status = 'cold';
                }
              }
              // Regular string fields
              else {
                contact[mappedField] = value;
              }
            }
          });

          // Set defaults - only if customer_tier wasn't set
          if (!contact.lead_status) contact.lead_status = 'cold';
          if (!contact.customer_tier) contact.customer_tier = 'LEAD';
          if (contact.disputed_amount && contact.disputed_amount > 0) {
            contact.has_disputed = true;
          }
          
          // CRITICAL: Ensure full_name is always set (required field)
          if (!contact.full_name) {
            if (contact.first_name || contact.last_name) {
              contact.full_name = `${contact.first_name || ''} ${contact.last_name || ''}`.trim();
            } else if (contact.email) {
              // Use email username as fallback
              contact.full_name = contact.email.split('@')[0];
            } else {
              // Last resort: use row number
              contact.full_name = `Contact ${i + batch.indexOf(row) + 1}`;
            }
          }

          return contact;
        }).filter(contact => contact.email); // Only import contacts with email

        // Process each contact individually to check for email OR phone duplicates
        const processedContacts = [];
        
        for (const contact of contacts) {
          try {
            // Check for existing contact by email OR normalized phone
            const { data: existing } = await supabase
              .from('contacts')
              .select('id, email, phone_number, total_spent')
              .or(`email.eq.${contact.email}${contact.phone_number ? `,phone_number.eq.${contact.phone_number}` : ''}`)
              .order('total_spent', { ascending: false, nullsFirst: false })
              .limit(1)
              .maybeSingle();

            if (existing) {
              // Update existing contact
              const { data: updated, error: updateError } = await supabase
                .from('contacts')
                .update(contact)
                .eq('id', existing.id)
                .select()
                .single();
              
              if (!updateError && updated) {
                processedContacts.push(updated);
              }
            } else {
              // Insert new contact (trigger will normalize phone automatically)
              const { data: inserted, error: insertError } = await supabase
                .from('contacts')
                .insert(contact)
                .select()
                .single();
              
              if (!insertError && inserted) {
                processedContacts.push(inserted);
              }
            }
          } catch (err) {
            console.error('Error processing contact:', contact.email, err);
          }
        }

        const data = processedContacts;
        const error = processedContacts.length === 0 ? new Error('No contacts processed') : null;

        if (error) {
          console.error("Batch insert error:", error);
          console.error("Failed contacts sample:", contacts.slice(0, 2));
          failed += batch.length;
        } else {
          imported += data?.length || 0;
          // Track imported contact IDs for score calculation
          if (data) {
            importedContactIds.push(...data.map(c => c.id));
          }
        }
        
        // Small delay to avoid rate limiting
        if (i + batchSize < dataRows.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        setProgress(Math.round(((i + batch.length) / dataRows.length) * 100));
      }

      const totalProcessed = imported + failed;
      console.log(`Import complete: ${imported} imported, ${failed} failed out of ${dataRows.length} rows`);
      
      // Show immediate success message
      if (imported > 0) {
        toast.success(`Successfully imported ${imported} contacts!`);
      }
      
      if (failed > 0) {
        toast.warning(`${failed} contacts failed to import`, {
          description: "Check console for error details"
        });
      }
      
      // Close dialog immediately so user can continue working
      setOpen(false);
      setFile(null);
      setProgress(0);
      
      if (onImportComplete) {
        onImportComplete();
      }
      
      // Calculate scores for imported contacts in background (don't await)
      if (importedContactIds.length > 0) {
        toast.info(`Calculating scores for ${importedContactIds.length} contacts...`, { duration: 3000 });
        
        // Fire and forget - don't block UI
        supabase.functions.invoke('calculate-scores-batch', {
          body: { contactIds: importedContactIds }
        }).then(({ data, error }) => {
          if (error) {
            console.error("Score calculation error:", error);
            toast.warning("Score calculation failed. You can manually recalculate later.");
          } else {
            console.log("Score calculation result:", data);
            toast.success(`Scores calculated for ${data.updated || 0} contacts!`, {
              duration: 5000
            });
          }
        }).catch(err => {
          console.error("Score sync error:", err);
        });
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
          <div className="flex items-center justify-between">
            <Label>Import Template</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={downloadInfluencerTemplate}
              className="gap-2"
            >
              <Download className="h-3 w-3" />
              Download Template
            </Button>
          </div>

          <div className="p-3 bg-muted rounded-lg text-sm space-y-2">
            <p className="font-medium">For influencer imports, include these columns:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground text-xs">
              <li><strong>Name</strong> (required) - Full name</li>
              <li><strong>Email</strong> (required) - Contact email</li>
              <li><strong>Phone</strong> - Phone number with country code</li>
              <li><strong>Platform</strong> - tiktok, youtube, instagram, blog, twitter, news</li>
              <li><strong>Handle</strong> - @username on platform</li>
              <li><strong>Followers</strong> - Number of followers</li>
              <li><strong>Engagement Rate</strong> - Percentage (e.g., 5.2)</li>
              <li><strong>Niche</strong> - Comma or pipe-separated: fitness|beauty|tech</li>
              <li><strong>Tier</strong> - nano, micro, mid, macro, mega</li>
            </ul>
          </div>

          <div className="space-y-2">
            <Label htmlFor="csv-file">Select CSV File</Label>
            <Input
              id="csv-file"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              disabled={loading}
            />
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
