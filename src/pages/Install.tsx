import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Bell, Download, Share2, Smartphone, CheckCircle2 } from "lucide-react";
import {
  canInstall,
  promptInstall,
  isStandalone,
  isPreviewOrIframe,
  enablePushNotifications,
  getPushStatus,
} from "@/lib/pwa";
import { toast } from "sonner";

export default function Install() {
  const [installable, setInstallable] = useState(canInstall());
  const [installed, setInstalled] = useState(isStandalone());
  const [pushStatus, setPushStatus] = useState(getPushStatus());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onInstallable = () => setInstallable(true);
    const onInstalled = () => { setInstalled(true); setInstallable(false); };
    window.addEventListener("petos:installable", onInstallable);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("petos:installable", onInstallable);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const preview = isPreviewOrIframe();

  async function handleInstall() {
    setBusy(true);
    const outcome = await promptInstall();
    setBusy(false);
    if (outcome === "accepted") toast.success("Petos installed!");
    else if (outcome === "dismissed") toast("Maybe later");
    else toast("Use your browser's menu to add Petos to your home screen");
  }

  async function handleEnablePush() {
    setBusy(true);
    const r = await enablePushNotifications();
    setBusy(false);
    setPushStatus(getPushStatus());
    if (r.ok) toast.success("Notifications enabled");
    else toast.error(r.reason || "Could not enable notifications");
  }

  useEffect(() => { document.title = "Install Petos — Add to Home Screen"; }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/90 backdrop-blur border-b">
        <div className="max-w-xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/" aria-label="Back"><ArrowLeft className="w-5 h-5" /></Link>
          <h1 className="text-lg font-semibold">Install Petos</h1>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-6 space-y-4">
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <Smartphone className="w-6 h-6 text-primary mt-1" />
            <div>
              <h2 className="font-semibold">Get the app feel</h2>
              <p className="text-sm text-muted-foreground">
                Install Petos to your home screen for full-screen, fast, offline-aware access.
              </p>
            </div>
          </div>

          <div className="mt-4">
            {installed ? (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle2 className="w-4 h-4" /> Installed — open from your home screen.
              </div>
            ) : preview ? (
              <p className="text-sm text-muted-foreground">
                Install isn't available in the preview. Open the published URL on your phone.
              </p>
            ) : isIOS ? (
              <div className="text-sm text-muted-foreground space-y-2">
                <p className="flex items-center gap-2"><Share2 className="w-4 h-4" /> On iPhone: tap the <b>Share</b> icon in Safari.</p>
                <p>Then choose <b>Add to Home Screen</b>.</p>
              </div>
            ) : installable ? (
              <Button onClick={handleInstall} disabled={busy} className="w-full">
                <Download className="w-4 h-4 mr-2" /> Install Petos
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">
                Use your browser's menu → <b>Install app</b> / <b>Add to Home Screen</b>.
              </p>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-start gap-3">
            <Bell className="w-6 h-6 text-primary mt-1" />
            <div>
              <h2 className="font-semibold">Push notifications</h2>
              <p className="text-sm text-muted-foreground">
                Get alerts for missing-pet sightings nearby, vet replies, mating matches and chats — even when the app is closed.
              </p>
            </div>
          </div>

          <div className="mt-4">
            {pushStatus === "granted" ? (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle2 className="w-4 h-4" /> Notifications are on
              </div>
            ) : pushStatus === "preview" ? (
              <p className="text-sm text-muted-foreground">Available on the published app, not in this preview.</p>
            ) : pushStatus === "unsupported" ? (
              <p className="text-sm text-muted-foreground">This browser doesn't support push notifications.</p>
            ) : (
              <Button onClick={handleEnablePush} disabled={busy} variant="default" className="w-full">
                <Bell className="w-4 h-4 mr-2" /> Enable notifications
              </Button>
            )}
          </div>
        </Card>

        <p className="text-xs text-muted-foreground text-center">
          You can change these anytime in Settings → Notifications.
        </p>
      </main>
    </div>
  );
}
