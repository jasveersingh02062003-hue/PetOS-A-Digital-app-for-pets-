import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const ForgotPassword = () => {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = z.string().trim().email().safeParse(email);
    if (!parsed.success) { toast.error("Enter a valid email"); return; }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setSent(true);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="container-app flex-1 flex flex-col justify-center py-12 max-w-sm">
        <Link to="/auth" className="text-xs uppercase tracking-wide text-muted-foreground">← Back</Link>
        <h1 className="font-display text-3xl mt-6 mb-2">Reset password</h1>
        <p className="text-sm text-muted-foreground mb-8">We'll email you a secure link.</p>

        {sent ? (
          <div className="rounded-xl border border-hairline bg-muted/40 p-4">
            <p className="text-sm">Check your inbox at <span className="font-medium">{email}</span> for a reset link. It expires in 1 hour.</p>
            <Button onClick={() => nav("/auth")} variant="ghost" size="sm" className="mt-3 px-0">Back to sign in</Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Email</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" className="h-12 rounded-xl border-hairline bg-card" />
            </div>
            <Button type="submit" disabled={loading} size="lg" className="w-full rounded-xl h-12">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send reset link"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
