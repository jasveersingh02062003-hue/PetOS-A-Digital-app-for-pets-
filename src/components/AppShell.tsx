import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { BottomNav } from "./BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { EmergencySheet } from "./EmergencySheet";
import { NotificationBell } from "./NotificationBell";
import { ComposerButton } from "./Composer";
import { ContextualFab } from "./ContextualFab";
import { OfflineBanner } from "./OfflineBanner";
import { SkipToContent } from "./SkipToContent";
import { InstallAppBanner } from "./InstallAppBanner";
import { EmergencyBanner } from "./EmergencyBanner";
import { isPublicRoute } from "@/lib/publicRoutes";
import { useLayoutMode } from "@/hooks/useLayoutMode";
import { WebShell } from "./WebShell";
import { PublicShell } from "./PublicShell";

export const AppShell = () => {
  const { user, loading } = useAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const loc = useLocation();
  const nav = useNavigate();
  const layoutMode = useLayoutMode();
  const [emergencyOpen, setEmergencyOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    
    // Auth Guard
    if (!user && !isPublicRoute(loc.pathname)) {
      nav("/auth", { replace: true });
      return;
    }

    // Onboarding Guard (Only force in mobile-app mode)
    if (user && !profileLoading && profile) {
      if (!profile.onboarded && layoutMode === "mobile-app" && !loc.pathname.startsWith("/onboarding")) {
        nav("/onboarding", { replace: true });
        return;
      }
      
      // If user is on Web and hits '/', redirect to '/dashboard'
      if (layoutMode === "web" && loc.pathname === "/") {
        nav("/dashboard", { replace: true });
      }
    }
  }, [user, loading, profile, profileLoading, loc.pathname, nav, layoutMode]);

  // If in Web Mode, we use the desktop-friendly shells
  if (layoutMode === "web") {
    if (isPublicRoute(loc.pathname)) {
      return (
        <PublicShell>
          <SkipToContent />
          <Outlet />
        </PublicShell>
      );
    }
    return (
      <WebShell>
        <SkipToContent />
        <OfflineBanner />
        <Outlet />
        <EmergencySheet open={emergencyOpen} onOpenChange={setEmergencyOpen} />
      </WebShell>
    );
  }

  // Default Mobile/App Mode shell
  return (
    <div className="min-h-screen bg-background">
      <SkipToContent />
      <OfflineBanner />
      <InstallAppBanner />
      {user && <EmergencyBanner />}
      {user && (
        <div className="fixed top-3 right-3 z-40 pad-top-safe">
          <NotificationBell />
        </div>
      )}
      <main id="main-content" tabIndex={-1} className="pad-bottom-nav animate-fade-in focus:outline-none">
        <Outlet />
      </main>
      <BottomNav onEmergency={() => setEmergencyOpen(true)} />
      <EmergencySheet open={emergencyOpen} onOpenChange={setEmergencyOpen} />
      {user && <ContextualFab onEmergency={() => setEmergencyOpen(true)} />}
      {user && <ComposerButton variant="global" />}
    </div>
  );
};
