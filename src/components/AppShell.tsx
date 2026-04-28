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

const PUBLIC_ROUTES = ["/auth", "/v/"];

export const AppShell = () => {
  const { user, loading } = useAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const loc = useLocation();
  const nav = useNavigate();
  const [emergencyOpen, setEmergencyOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    const isPublic = PUBLIC_ROUTES.some((p) => loc.pathname.startsWith(p));
    if (!user && !isPublic) {
      nav("/auth", { replace: true });
      return;
    }
    if (user && !profileLoading && profile && !profile.onboarded && !loc.pathname.startsWith("/onboarding")) {
      nav("/onboarding", { replace: true });
    }
  }, [user, loading, profile, profileLoading, loc.pathname, nav]);

  return (
    <div className="min-h-screen bg-background">
      <SkipToContent />
      <OfflineBanner />
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
