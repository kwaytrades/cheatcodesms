import { Users, BarChart3, MessageSquare, Send, LogOut, Zap, Settings, Sparkles, Video, TrendingUp, Bot } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const navItems = [
  { title: "Analytics", url: "/", icon: BarChart3 },
  { title: "Funnels", url: "/analytics/funnels", icon: TrendingUp },
  { title: "Contacts", url: "/contacts", icon: Users },
  { title: "Campaigns", url: "/campaigns", icon: Send },
  { title: "Automation", url: "/automation", icon: Sparkles },
  { title: "Content Studio", url: "/content-studio", icon: Video },
  { title: "Inbox", url: "/inbox", icon: MessageSquare },
  { title: "AI Agents", url: "/agents", icon: Bot },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Error signing out");
    } else {
      toast.success("Signed out successfully");
      navigate("/auth");
    }
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="icon-bg-green p-2 rounded-lg">
            <Zap className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-base truncate">Cheat Code</h2>
            <p className="text-xs text-muted-foreground truncate">SMS Platform</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
               {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      className={({ isActive }) =>
                        isActive 
                          ? "bg-primary/10 text-primary font-medium border-l-4 border-primary pl-3" 
                          : "hover:bg-sidebar-accent transition-colors"
                      }
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 border-t border-border/50">
        <Button variant="ghost" onClick={handleSignOut} className="w-full justify-start">
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
