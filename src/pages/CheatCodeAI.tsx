import { Outlet, NavLink } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp } from "lucide-react";

export default function CheatCodeAI() {
  return (
    <div className="flex-1 flex flex-col">
      <div className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="icon-bg-green p-2 rounded-lg">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Cheat Code AI</h1>
              <p className="text-sm text-muted-foreground">Trade Analysis Agent Management</p>
            </div>
          </div>
          
          <Tabs value={window.location.pathname.split('/').pop() || 'cheat-code-ai'} className="w-full">
            <TabsList className="grid w-full grid-cols-7 bg-muted/30">
              <TabsTrigger value="cheat-code-ai" asChild>
                <NavLink to="/cheat-code-ai">Dashboard</NavLink>
              </TabsTrigger>
              <TabsTrigger value="users" asChild>
                <NavLink to="/cheat-code-ai/users">Users</NavLink>
              </TabsTrigger>
              <TabsTrigger value="conversations" asChild>
                <NavLink to="/cheat-code-ai/conversations">Conversations</NavLink>
              </TabsTrigger>
              <TabsTrigger value="testing" asChild>
                <NavLink to="/cheat-code-ai/testing">Testing</NavLink>
              </TabsTrigger>
              <TabsTrigger value="analytics" asChild>
                <NavLink to="/cheat-code-ai/analytics">Analytics</NavLink>
              </TabsTrigger>
              <TabsTrigger value="settings" asChild>
                <NavLink to="/cheat-code-ai/settings">Settings</NavLink>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}
