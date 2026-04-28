import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const emailSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(6, "At least 6 characters"),
  fullName: z.string().trim().min(1).max(80).optional(),
});

const Auth = () => {
  const nav = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = emailSchema.safeParse({ email, password, fullName: mode === "signup" ? fullName : undefined });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        toast.success("Account created — welcome to Petos");
        nav("/onboarding", { replace: true });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        nav("/", { replace: true });
      }
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/` },
    });
    if (error) {
      toast.error(error.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="container-app flex-1 flex flex-col justify-center py-12">
        <div className="mb-12 text-center">
          <div className="inline-block mb-6">
            <div className="font-display text-5xl tracking-tight">Petos</div>
            <div className="hairline mt-3 w-12 mx-auto" />
          </div>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
            A complete digital life for every pet — social, healthy, and safe.
          </p>
        </div>

        <Tabs value={mode} onValueChange={(v) => setMode(v as any)} className="w-full">
          <TabsList className="grid grid-cols-2 w-full bg-muted rounded-xl">
            <TabsTrigger value="signin" className="rounded-lg">Sign in</TabsTrigger>
            <TabsTrigger value="signup" className="rounded-lg">Create account</TabsTrigger>
          </TabsList>

          <TabsContent value="signin" className="mt-6">
            <form onSubmit={handleEmail} className="space-y-4">
              <Field label="Email" value={email} onChange={setEmail} type="email" autoComplete="email" />
              <Field label="Password" value={password} onChange={setPassword} type="password" autoComplete="current-password" />
              <Button type="submit" disabled={loading} size="lg" className="w-full rounded-xl h-12">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup" className="mt-6">
            <form onSubmit={handleEmail} className="space-y-4">
              <Field label="Full name" value={fullName} onChange={setFullName} autoComplete="name" />
              <Field label="Email" value={email} onChange={setEmail} type="email" autoComplete="email" />
              <Field label="Password" value={password} onChange={setPassword} type="password" autoComplete="new-password" />
              <Button type="submit" disabled={loading} size="lg" className="w-full rounded-xl h-12">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <div className="my-6 flex items-center gap-3">
          <div className="flex-1 hairline" />
          <span className="text-xs text-muted-foreground tracking-wide uppercase">or</span>
          <div className="flex-1 hairline" />
        </div>

        <Button onClick={handleGoogle} variant="outline" size="lg" disabled={loading} className="w-full rounded-xl h-12 border-hairline">
          <GoogleIcon className="h-5 w-5 mr-2" />
          Continue with Google
        </Button>

        <p className="mt-8 text-center text-xs text-muted-foreground leading-relaxed">
          By continuing you agree to Petos's Terms and Privacy Policy.
        </p>
      </div>
    </div>
  );
};

const Field = ({ label, value, onChange, type = "text", autoComplete }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; autoComplete?: string;
}) => (
  <div className="space-y-1.5">
    <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{label}</Label>
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      type={type}
      autoComplete={autoComplete}
      className="h-12 rounded-xl border-hairline bg-card"
    />
  </div>
);

const GoogleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
);

export default Auth;
