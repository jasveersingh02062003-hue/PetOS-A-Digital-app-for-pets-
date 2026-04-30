import { useState, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { ContactSellerSheet, type PendingIntent } from "@/components/ContactSellerSheet";
import { supabase } from "@/integrations/supabase/client";
import { getAnonSessionId } from "@/lib/anonSession";

/**
 * Universal OTP gate. Wraps any CTA that requires an account.
 *
 * Usage:
 *   <OtpGate intent={{ kind: "donate", orgUserId, redirect: "/orgs/abc" }}>
 *     {(open) => <Button onClick={open}>Donate</Button>}
 *   </OtpGate>
 *
 * If the user is already authed, `onAuthed` runs immediately. Otherwise the
 * OTP sheet opens, the intent is persisted, and after verification
 * `useIntentReplay` (mounted at app shell) brings them back to `redirect`
 * with `?resume=<kind>` so the host page can finish the action.
 */
type Props = {
  intent: PendingIntent;
  title?: string;
  description?: string;
  /** Optional callback when an already-authenticated user activates the CTA. */
  onAuthed?: () => void;
  /** Render-prop receiving an `open` callback to wire to your CTA. */
  children: (open: () => void) => ReactNode;
};

export const OtpGate = ({ intent, title, description, onAuthed, children }: Props) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  const trigger = () => {
    if (user) {
      onAuthed?.();
      return;
    }
    // Log a guest intent event (best-effort)
    try {
      void supabase.from("intent_events").insert({
        anon_session_id: getAnonSessionId(),
        kind: intent.kind,
        redirect: intent.redirect,
        payload: intent as any,
      });
    } catch {}
    setOpen(true);
  };

  return (
    <>
      {children(trigger)}
      <ContactSellerSheet
        open={open}
        onOpenChange={setOpen}
        intent={intent}
        title={title}
        description={description}
      />
    </>
  );
};