import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState<string | null>(null);

  const handleGoogle = async () => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error(result.error.message || "Google sign-in failed");
        return;
      }
      if (result.redirected) return;
      nav("/", { replace: true });
    } catch (err: any) {
      toast.error(err.message || "Google sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!verifyEmail) return;
    setLoading(true);
    const { error } = await supabase.auth.resend({ type: "signup", email: verifyEmail });
    setLoading(false);
    if (error) toast.error(error.message);
    else toast.success("Verification email re-sent");
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = emailSchema.safeParse({ email, password, fullName: mode === "signup" ? fullName : undefined });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    if (mode === "signup" && !agreed) {
      toast.error("Please agree to the Terms and Privacy Policy");
      return;
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        // Email auto-confirm is on — sign the user straight in if no session was returned.
        if (!data.session) {
          const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
          if (signInErr) throw signInErr;
        }
        toast.success("Welcome to Petos");
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

  if (verifyEmail) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="container-app flex-1 flex flex-col justify-center py-12 max-w-sm">
          <div className="mb-10 text-center">
            <div className="font-display text-5xl tracking-tight">Petos</div>
            <div className="hairline mt-3 w-12 mx-auto" />
          </div>
          <div className="rounded-xl border border-hairline bg-card p-5 space-y-3">
            <h2 className="font-display text-xl">Check your inbox</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We sent a verification link to <span className="font-medium text-foreground">{verifyEmail}</span>. Tap it to finish setting up your account.
            </p>
            <Button onClick={handleResend} disabled={loading} variant="outline" size="sm" className="w-full rounded-xl">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Resend verification email"}
            </Button>
            <Button onClick={() => { setVerifyEmail(null); setMode("signin"); }} variant="ghost" size="sm" className="w-full">
              Back to sign in
            </Button>
          </div>
        </div>
      </div>
    );
  }

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

        <Button
          type="button"
          onClick={handleGoogle}
          disabled={loading}
          variant="outline"
          size="lg"
          className="w-full rounded-xl h-12 mb-4 gap-2.5 border-hairline bg-card"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.07H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.93l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
          </svg>
          Continue with Google
        </Button>

        <div className="flex items-center gap-3 mb-4">
          <div className="h-px flex-1 bg-hairline" />
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">or</span>
          <div className="h-px flex-1 bg-hairline" />
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
              <div className="text-center">
                <Link to="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline">
                  Forgot password?
                </Link>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="signup" className="mt-6">
            <form onSubmit={handleEmail} className="space-y-4">
              <Field label="Full name" value={fullName} onChange={setFullName} autoComplete="name" />
              <Field label="Email" value={email} onChange={setEmail} type="email" autoComplete="email" />
              <Field label="Password" value={password} onChange={setPassword} type="password" autoComplete="new-password" />
              <label className="flex items-start gap-2.5 pt-1 cursor-pointer">
                <Checkbox checked={agreed} onCheckedChange={(v) => setAgreed(!!v)} className="mt-0.5" />
                <span className="text-xs text-muted-foreground leading-relaxed">
                  I agree to Petos's{" "}
                  <Link to="/legal/terms" className="underline text-foreground">Terms</Link>{" "}
                  and{" "}
                  <Link to="/legal/privacy" className="underline text-foreground">Privacy Policy</Link>.
                </span>
              </label>
              <Button type="submit" disabled={loading} size="lg" className="w-full rounded-xl h-12">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <p className="mt-10 text-center text-xs text-muted-foreground leading-relaxed">
          By continuing you agree to our{" "}
          <Link to="/legal/terms" className="underline">Terms</Link>{" "}·{" "}
          <Link to="/legal/privacy" className="underline">Privacy</Link>{" "}·{" "}
          <Link to="/legal/refunds" className="underline">Refunds</Link>
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

export default Auth;
