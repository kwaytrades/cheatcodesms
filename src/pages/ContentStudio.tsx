import { Outlet, Link, useLocation } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Wand2, Video, FolderOpen, Scissors } from "lucide-react";

const ContentStudio = () => {
  const location = useLocation();
  const currentTab = location.pathname.split('/')[2] || 'news';

  return (
    <div className="h-full flex flex-col">
      <div className="flex-none border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-[#A25DDC] to-[#8B45C0] bg-clip-text text-transparent">
                Content Studio
              </h1>
              <p className="text-muted-foreground mt-1">Create engaging video content from trending news</p>
            </div>
          </div>
          
          <Tabs value={currentTab} className="w-full">
            <TabsList className="grid w-full max-w-4xl grid-cols-6">
              <TabsTrigger value="news" asChild>
                <Link to="/content-studio/news" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  News Discovery
                </Link>
              </TabsTrigger>
              <TabsTrigger value="scripts" asChild>
                <Link to="/content-studio/scripts" className="flex items-center gap-2">
                  <Wand2 className="h-4 w-4" />
                  Script Generator
                </Link>
              </TabsTrigger>
              <TabsTrigger value="recorder" asChild>
                <Link to="/content-studio/recorder" className="flex items-center gap-2">
                  <Video className="h-4 w-4" />
                  Video Recorder
                </Link>
              </TabsTrigger>
              <TabsTrigger value="library" asChild>
                <Link to="/content-studio/library" className="flex items-center gap-2">
                  <FolderOpen className="h-4 w-4" />
                  Content Library
                </Link>
              </TabsTrigger>
              <TabsTrigger value="editor" asChild>
                <Link to="/content-studio/editor" className="flex items-center gap-2">
                  <Scissors className="h-4 w-4" />
                  Video Editor
                </Link>
              </TabsTrigger>
              <TabsTrigger value="settings" asChild>
                <Link to="/content-studio/settings" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Style Guides
                </Link>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>
      
      <div className="flex-1 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
};

export default ContentStudio;
