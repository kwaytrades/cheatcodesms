import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Analytics from "./pages/Analytics";
import FunnelAnalytics from "./pages/FunnelAnalytics";
import FunnelBuilder from "./pages/FunnelBuilder";
import Contacts from "./pages/Contacts";
import ContactDetail from "./pages/ContactDetail";
import Campaigns from "./pages/Campaigns";
import CampaignBuilder from "./pages/CampaignBuilder";
import CampaignDetail from "./pages/CampaignDetail";
import Inbox from "./pages/Inbox";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import AutomationTriggers from "./pages/AutomationTriggers";
import ContentStudio from "./pages/ContentStudio";
import NewsDiscovery from "./pages/content-studio/NewsDiscovery";
import ScriptGenerator from "./pages/content-studio/ScriptGenerator";
import VideoRecorder from "./pages/content-studio/VideoRecorder";
import ContentLibrary from "./pages/content-studio/ContentLibrary";
import StyleGuides from "./pages/content-studio/StyleGuides";
import VideoEditor from "./pages/content-studio/VideoEditor";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/" element={<Dashboard />}>
            <Route index element={<Analytics />} />
            <Route path="analytics/funnels" element={<FunnelAnalytics />} />
            <Route path="funnels" element={<FunnelBuilder />} />
            <Route path="contacts" element={<Contacts />} />
            <Route path="contacts/:id" element={<ContactDetail />} />
            <Route path="campaigns" element={<Campaigns />} />
            <Route path="campaigns/new" element={<CampaignBuilder />} />
            <Route path="campaigns/:id" element={<CampaignDetail />} />
            <Route path="inbox" element={<Inbox />} />
            <Route path="automation" element={<AutomationTriggers />} />
            <Route path="content-studio" element={<ContentStudio />}>
              <Route index element={<Navigate to="news" replace />} />
              <Route path="news" element={<NewsDiscovery />} />
              <Route path="scripts" element={<ScriptGenerator />} />
              <Route path="recorder" element={<VideoRecorder />} />
              <Route path="library" element={<ContentLibrary />} />
              <Route path="editor" element={<VideoEditor />} />
              <Route path="settings" element={<StyleGuides />} />
            </Route>
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
