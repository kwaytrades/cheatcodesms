import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Menu } from "lucide-react";
import { WorkspaceSwitcher } from "@/components/workspace/WorkspaceSwitcher";

const Dashboard = () => {

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
