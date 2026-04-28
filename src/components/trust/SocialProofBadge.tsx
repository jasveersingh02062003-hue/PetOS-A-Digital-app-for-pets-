import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users } from "lucide-react";

export function SocialProofBadge({ providerId, city }: { providerId: string; city?: string | null }) {
  const [data, setData] = useState<{ total_customers: number; in_city: number; repeat_customers: number } | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.rpc("provider_social_proof" as any, {
        _provider_id: providerId,
        _city: city || null,
      });
      if (active) setData((data as any) ?? null);
    })();
    return () => { active = false; };
  }, [providerId, city]);

  if (!data || data.total_customers === 0) return null;

  const messages: string[] = [];
  if (city && data.in_city >= 3) messages.push(`${data.in_city} in ${city}`);
  else if (data.total_customers >= 5) messages.push(`${data.total_customers} customers`);
  if (data.repeat_customers >= 2) messages.push(`${data.repeat_customers} repeat`);

  if (messages.length === 0) return null;

  return (
    <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">
      <Users className="h-3 w-3" />
      <span>{messages.join(" · ")}</span>
    </div>
  );
}