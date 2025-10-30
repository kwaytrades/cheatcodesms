import React from "react";
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
import SalesCampaigns from "./pages/SalesCampaigns";
import SalesCampaignBuilder from "./pages/SalesCampaignBuilder";
import SalesCampaignDetail from "./pages/SalesCampaignDetail";
import SalesCampaignEdit from "./pages/SalesCampaignEdit";
import Inbox from "./pages/Inbox";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import AutomationTriggers from "./pages/AutomationTriggers";
import ContentStudio from "./pages/ContentStudio";
import AIAgents from "./pages/AIAgents";
import AIAgentAnalytics from "./pages/AIAgentAnalytics";
import AIAgentSettings from "./pages/AIAgentSettings";
import AIAgentTypes from "./pages/AIAgentTypes";
import CheatCodeAI from "./pages/CheatCodeAI";
import CheatCodeDashboard from "./pages/cheat-code-ai/Dashboard";
import CheatCodeUsers from "./pages/cheat-code-ai/Users";
import CheatCodeUserDetail from "./pages/cheat-code-ai/UserDetail";
import CheatCodeConversations from "./pages/cheat-code-ai/Conversations";
import CheatCodeTesting from "./pages/cheat-code-ai/Testing";
import CheatCodeAnalytics from "./pages/cheat-code-ai/Analytics";
import CheatCodeSettings from "./pages/cheat-code-ai/Settings";
import NewsDiscovery from "./pages/content-studio/NewsDiscovery";
import ScriptGenerator from "./pages/content-studio/ScriptGenerator";
import VideoRecorder from "./pages/content-studio/VideoRecorder";
import ContentLibrary from "./pages/content-studio/ContentLibrary";
import StyleGuides from "./pages/content-studio/StyleGuides";
import VideoEditor from "./pages/content-studio/VideoEditor";
import AIVideoGeneration from "./pages/content-studio/AIVideoGeneration";
import AgentTesting from "./pages/content-studio/AgentTesting";
import Products from "./pages/Products";

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
            <Route path="sales-campaigns" element={<SalesCampaigns />} />
            <Route path="sales-campaigns/new" element={<SalesCampaignBuilder />} />
            <Route path="sales-campaigns/:id" element={<SalesCampaignDetail />} />
            <Route path="sales-campaigns/:id/edit" element={<SalesCampaignEdit />} />
            <Route path="inbox" element={<Inbox />} />
            <Route path="automation" element={<AutomationTriggers />} />
            <Route path="agents" element={<AIAgents />} />
            <Route path="agents/analytics" element={<AIAgentAnalytics />} />
            <Route path="agents/types" element={<AIAgentTypes />} />
            <Route path="agents/settings" element={<AIAgentSettings />} />
            <Route path="agents/test" element={<AgentTesting />} />
            <Route path="products" element={<Products />} />
            <Route path="cheat-code-ai" element={<CheatCodeAI />}>
              <Route index element={<CheatCodeDashboard />} />
              <Route path="users" element={<CheatCodeUsers />} />
              <Route path="users/:id" element={<CheatCodeUserDetail />} />
              <Route path="conversations" element={<CheatCodeConversations />} />
              <Route path="testing" element={<CheatCodeTesting />} />
              <Route path="analytics" element={<CheatCodeAnalytics />} />
              <Route path="settings" element={<CheatCodeSettings />} />
            </Route>
            <Route path="content-studio" element={<ContentStudio />}>
              <Route index element={<Navigate to="news" replace />} />
              <Route path="news" element={<NewsDiscovery />} />
              <Route path="scripts" element={<ScriptGenerator />} />
              <Route path="ai-video" element={<AIVideoGeneration />} />
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
