import { useRef, useEffect } from "react";
import EmailEditor, { EditorRef, EmailEditorProps } from "react-email-editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, Eye } from "lucide-react";

interface EmailTemplateEditorProps {
  onExportHtml: (html: string, design: any) => void;
  initialDesign?: any;
  onPreview?: () => void;
}

export const EmailTemplateEditor = ({ 
  onExportHtml, 
  initialDesign,
  onPreview 
}: EmailTemplateEditorProps) => {
  const emailEditorRef = useRef<EditorRef>(null);

  useEffect(() => {
    // Load design if provided
    if (initialDesign && emailEditorRef.current) {
      emailEditorRef.current.editor?.loadDesign(initialDesign);
    }
  }, [initialDesign]);

  const exportHtml = () => {
    const editor = emailEditorRef.current?.editor;
    if (!editor) return;

    editor.exportHtml((data) => {
      const { design, html } = data;
      onExportHtml(html, design);
    });
  };

  const onReady: EmailEditorProps['onReady'] = () => {
    // Editor is ready
    if (initialDesign && emailEditorRef.current?.editor) {
      emailEditorRef.current.editor.loadDesign(initialDesign);
    }
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Visual Email Editor</h3>
          <div className="flex gap-2">
            {onPreview && (
              <Button
                variant="outline"
                size="sm"
                onClick={onPreview}
              >
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </Button>
            )}
            <Button
              variant="default"
              size="sm"
              onClick={exportHtml}
            >
              <Download className="h-4 w-4 mr-2" />
              Save & Export
            </Button>
          </div>
        </div>
        
        <div className="border rounded-lg overflow-hidden" style={{ height: '600px' }}>
          <EmailEditor
            ref={emailEditorRef}
            onReady={onReady}
            minHeight="600px"
            options={{
              appearance: {
                theme: 'modern_light',
              },
              mergeTags: {
                FirstName: {
                  name: 'First Name',
                  value: '{{FirstName}}',
                },
                LastName: {
                  name: 'Last Name',
                  value: '{{LastName}}',
                },
                Email: {
                  name: 'Email',
                  value: '{{Email}}',
                },
                Phone: {
                  name: 'Phone',
                  value: '{{Phone}}',
                },
              },
            }}
          />
        </div>

        <p className="text-sm text-muted-foreground">
          Drag and drop elements to build your email. Use merge tags like {'{{FirstName}}'} for personalization.
        </p>
      </CardContent>
    </Card>
  );
};
