import { useEffect, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Mail, KeyRound } from "lucide-react";
import { track } from "@/lib/analytics";
import { z } from "zod";

const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email").max(255);

/**
 * Pending intent — replayed after OTP verifies.
 * Stored in localStorage so it survives the auth redirect / new tab.
 */
export type PendingIntent =
  | { kind: "contact_seller"; listingId: string; listingType: "adopt" | "mate" | "service"; ownerId: string; redirect: string }
  | { kind: "book_service"; providerId: string; redirect: string }
  | { kind: "follow_org"; orgUserId: string; redirect: string };

const INTENT_KEY = "petos_pending_intent";

export function savePendingIntent(intent: PendingIntent) {
  try { localStorage.setItem(INTENT_KEY, JSON.stringify(intent)); } catch {}
}
export function readPendingIntent(): PendingIntent | null {
  try {
    const raw = localStorage.getItem(INTENT_KEY);
    return raw ? JSON.parse(raw) as PendingIntent : null;
  } catch { return null; }
}
export function clearPendingIntent() {
  try { localStorage.removeItem(INTENT_KEY); } catch {}
}

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  intent: PendingIntent;
  title?: string;
  description?: string;
};

export const ContactSellerSheet = ({ open, onOpenChange, intent, title, description }: Props) => {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const resendTimer = useRef<number | null>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    resendTimer.current = window.setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => { if (resendTimer.current) window.clearTimeout(resendTimer.current); };
  }, [resendIn]);

  const sendCode = async () => {
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Enter a valid email");
      return;
    }
    const cleanEmail = parsed.data;
    setBusy(true);
    savePendingIntent(intent);
    const { error } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
      options: { shouldCreateUser: true, emailRedirectTo: window.location.origin + intent.redirect },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setEmail(cleanEmail);
    track("otp_sent", { intent: intent.kind });
    setStep("code");
    setResendIn(45);
    toast.success("Code sent. Check your inbox.");
  };

  const verifyCode = async () => {
    if (!code || code.length < 6) {
      toast.error("Enter the 6-digit code");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    track("otp_verified", { intent: intent.kind });
    toast.success("Account ready. Continuing…");
    onOpenChange(false);
    // Stay in-page so the in-memory `beforeinstallprompt` event survives.
    // <IntentReplay /> picks up the pending intent from localStorage and
    // navigates the user to the seller chat, then triggers the install nudge.
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader className="text-left">
          <SheetTitle>{title ?? "Sign in to contact"}</SheetTitle>
          <SheetDescription>
            {description ?? "We'll send a 6-digit code to your email. No password needed."}
          </SheetDescription>
        </SheetHeader>
        <div className="py-6 space-y-4">
          {step === "email" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="csheet-email" className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> Email</Label>
                <Input
                  id="csheet-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={busy}
                />
              </div>
              <Button onClick={sendCode} disabled={busy} className="w-full rounded-xl h-12">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send code"}
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="csheet-code" className="flex items-center gap-1.5"><KeyRound className="h-3.5 w-3.5" /> 6-digit code</Label>
                <Input
                  id="csheet-code"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  disabled={busy}
                />
                <p className="text-xs text-muted-foreground">Sent to {email}</p>
              </div>
              <Button onClick={verifyCode} disabled={busy} className="w-full rounded-xl h-12">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify & continue"}
              </Button>
              <div className="flex items-center justify-between">
                <Button variant="link" onClick={() => setStep("email")} className="px-0">
                  Use a different email
                </Button>
                <Button
                  variant="link"
                  className="px-0"
                  disabled={resendIn > 0 || busy}
                  onClick={sendCode}
                >
                  {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
                </Button>
              </div>
            </>
          )}
          <p className="text-[11px] text-muted-foreground text-center">
            By continuing you agree to our <a href="/legal/terms" className="underline">Terms</a> and <a href="/legal/privacy" className="underline">Privacy</a>.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
};