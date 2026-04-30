import { ShieldCheck, Clock, Award, CalendarDays, ShoppingBag } from "lucide-react";
import { useSellerTrust } from "@/hooks/useSellerTrust";

function formatResponse(min?: number | null) {
  if (min == null) return null;
  if (min < 60) return `~${Math.max(1, min)} min`;
  const hrs = Math.round(min / 60);
  if (hrs < 24) return `~${hrs} hr`;
  const d = Math.round(hrs / 24);
  return `~${d} day${d > 1 ? "s" : ""}`;
}

function formatMember(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

/**
 * Public-facing trust strip — safe to render on anonymous pages.
 * No PII. Uses the seller_trust SECURITY DEFINER RPC.
 */
export const TrustSignals = ({ userId, compact = false }: { userId?: string | null; compact?: boolean }) => {
  const { trust } = useSellerTrust(userId);
  if (!userId || !trust) return null;

  const reply = formatResponse(trust.response_minutes);
  const member = formatMember(trust.member_since);
  const tx = (trust.completed_bookings ?? 0) + (trust.completed_orders ?? 0);

  const chips: { icon: any; label: string; tone: string }[] = [];
  if (trust.verified) chips.push({ icon: ShieldCheck, label: "Verified", tone: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" });
  if (reply) chips.push({ icon: Clock, label: `Replies ${reply}`, tone: "bg-sky-500/10 text-sky-700 border-sky-500/30" });
  if (tx > 0) chips.push({ icon: Award, label: `${tx} completed`, tone: "bg-amber-500/10 text-amber-700 border-amber-500/30" });
  if (trust.completed_orders && trust.completed_orders > 0)
    chips.push({ icon: ShoppingBag, label: `${trust.completed_orders} orders`, tone: "bg-violet-500/10 text-violet-700 border-violet-500/30" });
  if (member && !compact) chips.push({ icon: CalendarDays, label: `Since ${member}`, tone: "bg-muted text-foreground border-border" });

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((c, i) => {
        const Icon = c.icon;
        return (
          <span
            key={i}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${c.tone}`}
          >
            <Icon className="h-3 w-3" />
            {c.label}
          </span>
        );
      })}
    </div>
  );
};