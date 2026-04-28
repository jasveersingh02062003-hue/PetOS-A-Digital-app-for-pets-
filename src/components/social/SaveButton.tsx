import { Bookmark } from "lucide-react";
import { useIsSaved, useToggleSave } from "@/hooks/usePostSave";
import { toast } from "sonner";

export const SaveButton = ({ postId }: { postId: string }) => {
  const { data: saved } = useIsSaved(postId);
  const toggle = useToggleSave();
  return (
    <button
      onClick={() =>
        toggle.mutate(
          { postId, saved: !!saved },
          {
            onSuccess: () => toast.message(saved ? "Removed from saved" : "Saved"),
            onError: (e: any) => toast.error(e.message ?? "Try again"),
          }
        )
      }
      aria-label={saved ? "Unsave" : "Save"}
      className="flex items-center gap-1.5 px-3 py-2 rounded-full hover:bg-muted/60 transition-colors"
    >
      <Bookmark className={`h-5 w-5 ${saved ? "fill-current text-primary" : ""}`} strokeWidth={1.6} />
    </button>
  );
};
