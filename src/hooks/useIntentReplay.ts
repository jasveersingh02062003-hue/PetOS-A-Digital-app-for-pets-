import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { readPendingIntent, clearPendingIntent, type PendingIntent } from "@/components/ContactSellerSheet";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { track } from "@/lib/analytics";
import { requestInstallNudge } from "@/components/InstallNudgeSheet";

/**
 * Mounts at AppShell level. After OTP signup, replays the user's
 * pre-auth intent (e.g. "open chat with this seller") so the friction
 * of signing in is rewarded with the action they came to do.
 */
export function useIntentReplay() {
  const { user, loading } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (loading || !user) return;
    const intent = readPendingIntent();
    if (!intent) return;

    (async () => {
      try {
        // Mark any open intent_events row for this anon session as completed
        try {
          await supabase
            .from("intent_events")
            .update({ user_id: user.id, completed_at: new Date().toISOString() })
            .is("completed_at", null)
            .eq("kind", intent.kind);
        } catch {}

        if (intent.kind === "contact_seller") {
          if (intent.ownerId === user.id) { clearPendingIntent(); return; }
          // Find or create 1:1 conversation with the seller
          const { data: existing } = await supabase
            .from("conversation_members")
            .select("conversation_id, conversations!inner(is_group)")
            .eq("user_id", user.id);
          let convId: string | null = null;
          for (const row of existing ?? []) {
            if ((row as any).conversations?.is_group) continue;
            const { data: members } = await supabase
              .from("conversation_members")
              .select("user_id")
              .eq("conversation_id", row.conversation_id);
            const ids = (members ?? []).map((m) => m.user_id);
            if (ids.length === 2 && ids.includes(intent.ownerId)) {
              convId = row.conversation_id;
              break;
            }
          }
          if (!convId) {
            const { data: c } = await supabase
              .from("conversations")
              .insert({ created_by: user.id, is_group: false })
              .select("id")
              .single();
            if (c) {
              convId = c.id;
              await supabase.from("conversation_members").insert([
                { conversation_id: convId, user_id: user.id },
                { conversation_id: convId, user_id: intent.ownerId },
              ]);
              // Auto-seed friendly first message so the conversation isn't empty
              await supabase.from("messages").insert({
                conversation_id: convId,
                sender_id: user.id,
                body: "Hi! I'm interested in your listing.",
              });
            }
          }
          if (convId) {
            track("intent_replayed", { kind: "contact_seller" });
            toast.success("Opening chat with seller…");
            nav(`/messages/${convId}`);
            setTimeout(() => requestInstallNudge("after_contact_seller"), 1200);
          }
          return;
        }

        // For all other kinds, just land back on the original page authed.
        // Each page reads its own ?resume= param / pending intent and continues.
        track("intent_replayed", { kind: intent.kind });
        if (intent.redirect && location.pathname !== intent.redirect) {
          nav(intent.redirect + (intent.redirect.includes("?") ? "&" : "?") + "resume=" + intent.kind);
        } else {
          // Same page — drop a query string so listeners can react
          const url = new URL(window.location.href);
          url.searchParams.set("resume", intent.kind);
          window.history.replaceState({}, "", url.toString());
          window.dispatchEvent(new CustomEvent("petos:intent-resume", { detail: intent satisfies PendingIntent }));
        }
        setTimeout(() => requestInstallNudge(`after_${intent.kind}`), 1500);
      } finally {
        clearPendingIntent();
      }
    })();
  }, [user, loading, nav]);
}