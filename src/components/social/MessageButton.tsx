import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { MessageCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function MessageButton({ userId, variant = "outline", size = "sm" }: {
  userId: string;
  variant?: "outline" | "default" | "ghost";
  size?: "sm" | "default";
}) {
  const { user } = useAuth();
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);

  const open = async () => {
    if (!user) return nav("/auth");
    if (user.id === userId) return;
    setLoading(true);
    const { data, error } = await supabase.rpc("get_or_create_dm" as any, { _other_user: userId });
    setLoading(false);
    if (error) return toast.error(error.message);
    nav(`/messages/${data}`);
  };

  if (user?.id === userId) return null;
  return (
    <Button onClick={open} variant={variant} size={size} className="gap-1.5" disabled={loading}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
      Message
    </Button>
  );
}
