import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet } from "react-router-dom";
import { Menu } from "lucide-react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { OnboardingFlow } from "@/components/workspace/OnboardingFlow";
import { WorkspaceSwitcher } from "@/components/workspace/WorkspaceSwitcher";

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { currentWorkspace, isLoading: workspaceLoading } = useWorkspace();

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading || workspaceLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-primary">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!currentWorkspace) {
    return <OnboardingFlow />;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex flex-col w-full">
        <header className="sticky top-0 z-50 w-full border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
          <div className="flex h-12 md:h-14 items-center px-3 md:px-4 justify-between">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="mr-2 -ml-2">
                <Menu className="h-5 w-5" />
              </SidebarTrigger>
              <h1 className="text-base md:text-lg font-semibold truncate">Cheat Code</h1>
            </div>
            <div className="w-[200px]">
              <WorkspaceSwitcher />
            </div>
          </div>
        </header>
        <div className="flex flex-1 w-full overflow-hidden">
          <AppSidebar />
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Dashboard;
