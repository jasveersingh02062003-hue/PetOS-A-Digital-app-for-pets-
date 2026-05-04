import React from "react";
import { Link, useLocation } from "react-router-dom";
import { 
  Home, 
  Compass, 
  Heart, 
  Activity, 
  User, 
  Search, 
  MessageSquare, 
  Bell, 
  Settings,
  Menu,
  X
} from "lucide-react";
import { PetosLogo } from "./PetosLogo";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { NotificationBell } from "./NotificationBell";

export const WebShell = ({ children }: { children: React.ReactNode }) => {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
  const location = useLocation();

  const navItems = [
    { to: "/", label: "Home", icon: Home },
    { to: "/discover", label: "Marketplace", icon: Search },
    { to: "/mates", label: "Mates", icon: Heart },
    { to: "/health", label: "Health Vault", icon: Activity },
    { to: "/messages", label: "Messages", icon: MessageSquare },
    { to: "/profile", label: "My Profile", icon: User },
  ];

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      {/* Top Header (Amazon-like) */}
      <header className="sticky top-0 z-50 bg-background border-b border-hairline h-16 flex items-center px-4 md:px-6 gap-4">
        <Button 
          variant="ghost" 
          size="icon" 
          className="lg:hidden" 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        >
          <Menu className="h-5 w-5" />
        </Button>
        
        <Link to="/" className="flex items-center gap-2">
          <PetosLogo className="h-8 w-auto text-primary" />
          <span className="font-display text-xl font-bold tracking-tight hidden sm:block">Petos</span>
        </Link>

        {/* Global Search Bar */}
        <div className="flex-1 max-w-2xl mx-auto relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Search for breeds, services, or pets..." 
            className="w-full bg-muted/50 border-hairline rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 md:gap-4 ml-auto">
          <NotificationBell />
          <Button variant="ghost" size="icon" asChild className="hidden sm:flex">
            <Link to="/settings"><Settings className="h-5 w-5" /></Link>
          </Button>
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center border border-hairline overflow-hidden">
             <User className="h-5 w-5 text-primary" />
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar Navigation */}
        <aside className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 bg-background border-r border-hairline transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <div className="h-full flex flex-col py-6 px-4">
            <nav className="space-y-1 flex-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.to || (item.to !== "/" && location.pathname.startsWith(item.to));
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors",
                      isActive 
                        ? "bg-primary/10 text-primary" 
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-auto p-4 bg-muted/50 rounded-2xl border border-hairline">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Need help?</p>
              <p className="text-[11px] text-muted-foreground mb-3">Our 24/7 emergency AI vet is always available for your pet.</p>
              <Button size="sm" className="w-full text-xs" variant="outline">Contact Support</Button>
            </div>
          </div>
        </aside>

        {/* Overlay for mobile sidebar */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/20 z-30 lg:hidden" 
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto bg-muted/20">
          <div className="container-app max-w-6xl mx-auto p-4 md:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
