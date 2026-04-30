import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { readPendingIntent, clearPendingIntent } from "@/components/ContactSellerSheet";
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
            }
          }
          if (convId) {
            track("intent_replayed", { kind: "contact_seller" });
            toast.success("Opening chat with seller…");
            nav(`/messages/${convId}`);
            // Phase D nudge — invite install + push so they don't miss the reply
            setTimeout(() => requestInstallNudge("after_contact_seller"), 1200);
          }
        }
        // book_service / follow_org → just land on redirect, the page handles it
      } finally {
        clearPendingIntent();
      }
    })();
  }, [user, loading, nav]);
}