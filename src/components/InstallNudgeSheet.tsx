import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Bell, Download, Share2, Smartphone } from "lucide-react";
import { canInstall, promptInstall, isStandalone, isPreviewOrIframe, enablePushNotifications, getPushStatus } from "@/lib/pwa";
import { track } from "@/lib/analytics";
import { toast } from "sonner";

const DISMISS_KEY = "petos_install_nudge_dismissed_at";
const NUDGE_REASON_KEY = "petos_install_nudge_pending";

/** Trigger an install nudge from anywhere (e.g. after a contact or order). */
export function requestInstallNudge(reason: string) {
  try {
    if (isStandalone()) return;
    const last = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (Date.now() - last < 7 * 24 * 60 * 60 * 1000) return; // 7-day cool-down
    localStorage.setItem(NUDGE_REASON_KEY, reason);
    window.dispatchEvent(new CustomEvent("petos:install-nudge", { detail: { reason } }));
  } catch { /* noop */ }
}

export const InstallNudgeSheet = () => {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const isIOS = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);

  useEffect(() => {
    const onNudge = (e: Event) => {
      const r = (e as CustomEvent).detail?.reason ?? "";
      setReason(r);
      setOpen(true);
      track("pwa_install_prompted", { reason: r });
    };
    window.addEventListener("petos:install-nudge", onNudge);
    return () => window.removeEventListener("petos:install-nudge", onNudge);
  }, []);

  const dismiss = (v: boolean) => {
    if (!v) {
      try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
      try { localStorage.removeItem(NUDGE_REASON_KEY); } catch {}
    }
    setOpen(v);
  };

  const handleInstall = async () => {
    setBusy(true);
    const outcome = await promptInstall();
    setBusy(false);
    if (outcome === "accepted") {
      track("pwa_installed", { reason });
      toast.success("Installed! Open Petos from your home screen.");
      dismiss(false);
    } else if (outcome === "dismissed") {
      dismiss(false);
    } else {
      toast("Use your browser's menu → Install app");
    }
  };

  const handlePush = async () => {
    setBusy(true);
    const r = await enablePushNotifications();
    setBusy(false);
    if (r.ok) {
      track("push_enabled", { reason });
      toast.success("Notifications on — we'll ping when the seller replies.");
      dismiss(false);
    } else {
      toast.error(r.reason || "Could not enable notifications");
    }
  };

  const preview = isPreviewOrIframe();
  const installable = canInstall();
  const pushStatus = getPushStatus();

  return (
    <Sheet open={open} onOpenChange={dismiss}>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2"><Smartphone className="h-5 w-5 text-primary" /> Don't miss the reply</SheetTitle>
          <SheetDescription>
            Install Petos and turn on notifications — get pinged the moment the seller replies, even when the app is closed.
          </SheetDescription>
        </SheetHeader>
        <div className="py-4 space-y-3">
          {preview ? (
            <p className="text-sm text-muted-foreground">Install isn't available in the preview. Open the published URL on your phone.</p>
          ) : isIOS ? (
            <div className="text-sm text-muted-foreground space-y-2 rounded-xl bg-muted/40 p-3">
              <p className="flex items-center gap-2"><Share2 className="h-4 w-4" /> Tap the <b>Share</b> icon in Safari.</p>
              <p>Then choose <b>Add to Home Screen</b>.</p>
            </div>
          ) : installable ? (
            <Button onClick={handleInstall} disabled={busy} className="w-full rounded-xl h-12">
              <Download className="h-4 w-4 mr-2" /> Install Petos
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">Use your browser menu → <b>Install app</b>.</p>
          )}

          {pushStatus !== "granted" && pushStatus !== "preview" && pushStatus !== "unsupported" && (
            <Button onClick={handlePush} disabled={busy} variant="outline" className="w-full rounded-xl h-12">
              <Bell className="h-4 w-4 mr-2" /> Enable seller-reply alerts
            </Button>
          )}

          <Button variant="ghost" onClick={() => dismiss(false)} className="w-full">Maybe later</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};