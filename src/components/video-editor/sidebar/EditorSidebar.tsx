import React from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Type, Video, Image, Music, MessageSquare, Sticker } from "lucide-react";
import { OverlayType } from "@/lib/video-editor/types";
import { useSidebarContext } from "@/contexts/video-editor/SidebarContext";
import { TextPanel } from "./panels/TextPanel";
import { VideoPanel } from "./panels/VideoPanel";
import { ImagePanel } from "./panels/ImagePanel";
import { SoundPanel } from "./panels/SoundPanel";

const panels = [
  { title: "Text", icon: Type, type: OverlayType.TEXT },
  { title: "Video", icon: Video, type: OverlayType.VIDEO },
  { title: "Image", icon: Image, type: OverlayType.IMAGE },
  { title: "Sound", icon: Music, type: OverlayType.SOUND },
];

export function EditorSidebar() {
  const { activePanel, setActivePanel } = useSidebarContext();

  const renderActivePanel = () => {
    switch (activePanel) {
      case OverlayType.TEXT:
        return <TextPanel />;
      case OverlayType.VIDEO:
        return <VideoPanel />;
      case OverlayType.IMAGE:
        return <ImagePanel />;
      case OverlayType.SOUND:
        return <SoundPanel />;
      default:
        return null;
    }
  };

  return (
    <Sidebar className="border-r">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Add Content</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {panels.map((panel) => (
                <SidebarMenuItem key={panel.type}>
                  <SidebarMenuButton
                    isActive={activePanel === panel.type}
                    onClick={() => setActivePanel(panel.type)}
                  >
                    <panel.icon className="h-4 w-4" />
                    <span>{panel.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="flex-1 overflow-auto">
          {renderActivePanel()}
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
