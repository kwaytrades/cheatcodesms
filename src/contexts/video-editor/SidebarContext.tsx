import React, { createContext, useContext, useState } from "react";
import { OverlayType } from "@/lib/video-editor/types";

type SidebarContextType = {
  activePanel: OverlayType | null;
  setActivePanel: (panel: OverlayType | null) => void;
};

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export const SidebarProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [activePanel, setActivePanel] = useState<OverlayType | null>(OverlayType.TEXT);

  const value = {
    activePanel,
    setActivePanel,
  };

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
};

export const useSidebarContext = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebarContext must be used within a SidebarProvider");
  }
  return context;
};
