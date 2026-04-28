import { Bookmark } from "lucide-react";
import { useIsSaved, useToggleSave } from "@/hooks/usePostSave";
import { toast } from "sonner";
import { useState } from "react";
import { haptic } from "@/lib/haptics";

export const SaveButton = ({ postId }: { postId: string }) => {
  const { data: saved } = useIsSaved(postId);
  const toggle = useToggleSave();
  const [pulseKey, setPulseKey] = useState(0);

  return (
    <button
      onClick={() => {
        haptic(8);
        setPulseKey((k) => k + 1);
        toggle.mutate(
          { postId, saved: !!saved },
          {
            onSuccess: () => toast.message(saved ? "Removed from saved" : "Saved"),
            onError: (e: any) => toast.error(e.message ?? "Try again"),
          }
        );
      }}
      aria-label={saved ? "Unsave" : "Save"}
      className="relative flex items-center gap-1.5 px-3 py-2 rounded-full hover:bg-muted/60 transition-colors"
    >
      <span key={pulseKey} className="inline-flex animate-pop">
        <Bookmark
          className={`h-5 w-5 transition-colors ${saved ? "fill-current text-primary" : ""}`}
          strokeWidth={1.6}
        />
      </span>
      {!saved && pulseKey > 0 && (
        <span
          key={`s-${pulseKey}`}
          className="pointer-events-none absolute left-1/2 top-0 text-xs animate-sparkle"
          style={{ color: "hsl(var(--primary))" }}
        >
          ✦
        </span>
      )}
    </button>
  );
};
