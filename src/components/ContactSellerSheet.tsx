import { useEffect, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Mail, KeyRound, Phone } from "lucide-react";
import { track } from "@/lib/analytics";
import { z } from "zod";

const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email").max(255);
// E.164: +<country><number>, total digits 8–15
const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{7,14}$/, "Enter phone in international format, e.g. +14155551234");

/**
 * Pending intent — replayed after OTP verifies.
 * Stored in localStorage so it survives the auth redirect / new tab.
 */
export type PendingIntent =
  | { kind: "contact_seller"; listingId: string; listingType: "adopt" | "mate" | "service"; ownerId: string; redirect: string }
  | { kind: "book_service"; providerId: string; redirect: string }
  | { kind: "follow_org"; orgUserId: string; redirect: string }
  | { kind: "apply_to_adopt"; listingId: string; ownerId: string; redirect: string }
  | { kind: "donate"; orgUserId: string; amount?: number; redirect: string }
  | { kind: "taxi_post"; redirect: string }
  | { kind: "subscribe_missing_alert"; missingPetId: string; redirect: string }
  | { kind: "shop_checkout"; redirect: string }
  | { kind: "vet_book"; providerId: string; redirect: string }
  | { kind: "save_quiz"; redirect: string }
  | { kind: "report_sighting"; missingPetId: string; redirect: string };

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
  const [channel, setChannel] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
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
    setBusy(true);
    savePendingIntent(intent);
    
    // DEBUG: Mock OTP send
    console.log("DEBUG: Mock OTP requested for", channel === "email" ? email : phone);
    setBusy(false);
    setStep("code");
    setResendIn(45);
    toast.success("DEBUG MODE: Enter any 4 digits (e.g. 1234)");
  };

  const verifyCode = async () => {
    if (!code || code.length < 4) {
      toast.error("Enter the 4-digit code");
      return;
    }
    setBusy(true);

    // DEBUG: Mock OTP verify
    // In dev, we accept any 4 digits for friction-less testing
    console.log("DEBUG: Mock OTP verified");
    setBusy(false);
    track("otp_verified", { intent: intent.kind, channel });
    toast.success("Account ready (Debug). Continuing…");
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
            {description ?? "We'll send a 4-digit code. No password needed."}
          </SheetDescription>
        </SheetHeader>
        <div className="py-6 space-y-4">
          {step === "email" ? (
            <>
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-muted">
                <button
                  type="button"
                  onClick={() => setChannel("email")}
                  className={`h-9 rounded-lg text-sm font-medium transition ${channel === "email" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
                >Email</button>
                <button
                  type="button"
                  onClick={() => setChannel("phone")}
                  className={`h-9 rounded-lg text-sm font-medium transition ${channel === "phone" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
                >Phone</button>
              </div>
              {channel === "email" ? (
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
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="csheet-phone" className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Phone</Label>
                  <Input
                    id="csheet-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="+14155551234"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={busy}
                  />
                  <p className="text-[11px] text-muted-foreground">Use international format, including country code.</p>
                </div>
              )}
              <Button onClick={sendCode} disabled={busy} className="w-full rounded-xl h-12">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send code"}
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="csheet-code" className="flex items-center gap-1.5"><KeyRound className="h-3.5 w-3.5" /> 4-digit code</Label>
                <Input
                  id="csheet-code"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  placeholder="1234"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  disabled={busy}
                />
                <p className="text-xs text-muted-foreground">Sent to {channel === "email" ? email : phone}</p>
              </div>
              <Button onClick={verifyCode} disabled={busy} className="w-full rounded-xl h-12">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify & continue"}
              </Button>
              <div className="flex items-center justify-between">
                <Button variant="link" onClick={() => setStep("email")} className="px-0">
                  Use a different {channel === "email" ? "email" : "phone"}
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