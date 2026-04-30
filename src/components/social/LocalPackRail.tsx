import { Link } from "react-router-dom";
import { useLocalPack } from "@/hooks/useLocalPack";
import { useProfile } from "@/hooks/useProfile";
import { MapPin } from "lucide-react";

export const LocalPackRail = () => {
  const { data: profile } = useProfile();
  const { data: pets, isLoading } = useLocalPack(15);

  if (!profile?.city) return null;
  if (isLoading) return null;
  if (!pets || pets.length === 0) return null;

  return (
    <section className="-mx-5 px-5 py-3 mb-2">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-display text-lg flex items-center gap-1.5">
          <MapPin className="h-4 w-4 text-primary" />
          Local Pack — {profile.city}
        </h2>
      </div>
      <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-5 px-5">
        {pets.map((p: any) => (
          <Link
            key={p.id}
            to={`/pet/${p.public_id ?? p.id}`}
            className="shrink-0 w-24 flex flex-col items-center gap-1.5"
          >
            <div className="h-20 w-20 rounded-2xl bg-muted overflow-hidden ring-1 ring-border">
              {p.avatar_url ? (
                <img src={p.avatar_url} alt={p.name} className="w-full h-full object-cover" loading="lazy" decoding="async" />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-display text-2xl text-ink-soft">
                  {p.name?.[0]}
                </div>
              )}
            </div>
            <span className="text-[11px] font-medium truncate w-full text-center">{p.name}</span>
            {p.breed && <span className="text-[10px] text-muted-foreground truncate w-full text-center">{p.breed}</span>}
          </Link>
        ))}
      </div>
    </section>
  );
};
