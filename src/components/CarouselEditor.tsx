import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Upload, Twitter, Loader2, X } from "lucide-react";
import { toast } from "sonner";

interface CarouselSlide {
  text: string;
  image: File | null;
  imagePreview: string | null;
  fontFamily?: string;
  fontSize?: number;
  textColor?: string;
  backgroundColor?: string;
}

interface CarouselEditorProps {
  scriptText: string;
  onSlidesChange?: (slides: CarouselSlide[]) => void;
}

export const CarouselEditor = ({ scriptText, onSlidesChange }: CarouselEditorProps) => {
  const [slides, setSlides] = useState<CarouselSlide[]>(() => {
    // Parse slides from script text (split by "Slide X:" pattern)
    const slideMatches = scriptText.match(/Slide \d+:([\s\S]*?)(?=Slide \d+:|$)/g) || [];
    return slideMatches.map(match => {
      const text = match.replace(/Slide \d+:\s*/, '').trim();
      return { 
        text, 
        image: null, 
        imagePreview: null,
        fontFamily: 'Roboto',
        fontSize: 24,
        textColor: '#ffffff',
        backgroundColor: '#1a1a1a'
      };
    });
  });

  const [exporting, setExporting] = useState(false);

  const handleImageUpload = (index: number, file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const newSlides = [...slides];
      newSlides[index] = {
        ...newSlides[index],
        image: file,
        imagePreview: e.target?.result as string,
      };
      setSlides(newSlides);
      onSlidesChange?.(newSlides);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = (index: number) => {
    const newSlides = [...slides];
    newSlides[index] = {
      ...newSlides[index],
      image: null,
      imagePreview: null,
    };
    setSlides(newSlides);
    onSlidesChange?.(newSlides);
  };

  const updateSlideText = (index: number, text: string) => {
    const newSlides = [...slides];
    newSlides[index] = { ...newSlides[index], text };
    setSlides(newSlides);
    onSlidesChange?.(newSlides);
  };


  const exportToTwitter = async () => {
    setExporting(true);
    try {
      // Convert slides to API format with base64 image data
      const slidesData = await Promise.all(
        slides.map(async (slide) => {
          let imageData = slide.imagePreview;
          
          // If there's a file, ensure it's in base64 format
          if (slide.image && !slide.imagePreview) {
            imageData = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onload = (e) => resolve(e.target?.result as string);
              reader.readAsDataURL(slide.image!);
            });
          }

          // Only include imageData if user explicitly uploaded an image
          return {
            text: slide.text,
            imageData: imageData || null,
          };
        })
      );

      const { supabase } = await import('@/integrations/supabase/client');
      
      const { data, error } = await supabase.functions.invoke('post-twitter-thread', {
        body: { slides: slidesData },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(`Successfully posted ${slides.length} tweets as a thread!`);
      } else {
        throw new Error(data?.error || 'Failed to post thread');
      }
      
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error(error.message || 'Failed to export thread to Twitter');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Carousel Preview */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Carousel Slides ({slides.length})</h3>
          <Button 
            onClick={exportToTwitter} 
            disabled={exporting}
          >
            {exporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Twitter className="h-4 w-4 mr-2" />
                Export as Thread
              </>
            )}
          </Button>
        </div>

        <Carousel className="w-full max-w-2xl mx-auto">
          <CarouselContent>
            {slides.map((slide, index) => (
              <CarouselItem key={index}>
                <Card className="p-6">
                  <div className="space-y-4">
                    {/* Slide Text */}
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Slide {index + 1} Text
                      </label>
                      <Textarea
                        value={slide.text}
                        onChange={(e) => updateSlideText(index, e.target.value)}
                        className="min-h-[120px]"
                        placeholder="Enter slide text..."
                      />
                    </div>

                    {/* Image Upload */}
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Image (Optional)
                      </label>
                      {slide.imagePreview ? (
                        <div className="relative">
                          <img 
                            src={slide.imagePreview} 
                            alt={`Slide ${index + 1}`}
                            className="w-full h-64 object-cover rounded-lg"
                          />
                          <Button
                            size="icon"
                            variant="destructive"
                            className="absolute top-2 right-2"
                            onClick={() => removeImage(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                          <Upload className="h-8 w-8 mb-2 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            Click to upload image
                          </span>
                          <Input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleImageUpload(index, file);
                            }}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                </Card>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious />
          <CarouselNext />
        </Carousel>
      </Card>

      {/* Slides Grid View */}
      <Card className="p-6">
        <h4 className="font-semibold mb-4">All Slides Overview</h4>
        <div className="grid grid-cols-2 gap-4">
          {slides.map((slide, index) => (
            <Card key={index} className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-16 h-16 bg-muted rounded flex items-center justify-center text-xl font-bold">
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm line-clamp-3 mb-2">{slide.text}</p>
                  {slide.imagePreview && (
                    <img 
                      src={slide.imagePreview} 
                      alt={`Slide ${index + 1}`}
                      className="w-full h-24 object-cover rounded"
                    />
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </Card>
    </div>
  );
};
