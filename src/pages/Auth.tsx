import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, PawPrint, Sparkles, ShieldCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { logError } from "@/lib/logError";

const emailSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(6, "At least 6 characters"),
  fullName: z.string().trim().min(1).max(80).optional(),
});

const Auth = () => {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const redirect = params.get("redirect");
  const postAuthTarget = redirect
    ? `/post-auth?redirect=${encodeURIComponent(redirect)}`
    : "/post-auth";

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleGoogle = async () => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/post-auth`,
      });
      if (result.error) {
        logError(result.error, { source: "auth:google" });
        toast.error(result.error.message || "Google sign-in failed");
        return;
      }
      if (result.redirected) return;
      nav(postAuthTarget, { replace: true });
    } catch (err: any) {
      logError(err, { source: "auth:google" });
      toast.error(err.message || "Google sign-in failed");
    } finally {
      setLoading(false);
    }
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
        // Pre-flight rate-limit check (fail-open on infra errors).
        try {
          const { data: rl } = await supabase.functions.invoke("signup-rate-limit", {
            body: { email },
          });
          if (rl && rl.allowed === false) {
            const msg =
              rl.reason === "too_many_attempts_email"
                ? "Too many signup attempts for this email. Please try again in an hour."
                : rl.reason === "too_many_attempts_ip"
                ? "Too many signup attempts from your network. Please try again in an hour."
                : "Signup temporarily unavailable. Please try again later.";
            toast.error(msg);
            setLoading(false);
            return;
          }
        } catch { /* fail-open */ }

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        if (error) throw error;
        toast.success("Welcome to Petos");
        nav(postAuthTarget, { replace: true });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        nav(postAuthTarget, { replace: true });
      }
    } catch (err: any) {
      logError(err, { source: mode === "signup" ? "auth:signup" : "auth:signin" });
      toast.error(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex flex-col overflow-hidden bg-background">
      {/* Ambient background blobs */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 -left-24 h-72 w-72 rounded-full bg-coral/20 blur-3xl" />
        <div className="absolute top-32 -right-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-72 w-[120%] rounded-full bg-lilac/15 blur-3xl" />
      </div>

      <div className="container-app flex-1 flex flex-col justify-center py-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="mb-8 text-center"
        >
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-coral mb-4 shadow-lg shadow-primary/20">
            <PawPrint className="h-8 w-8 text-primary-foreground" strokeWidth={2.2} />
          </div>
          <div className="font-display text-[40px] tracking-tight leading-none">Petos</div>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed mt-3">
            A complete digital life for every pet — social, healthy, and safe.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
          className="rounded-3xl bg-card/80 backdrop-blur-xl border border-hairline p-5 shadow-xl shadow-black/5"
        >

        <Button
          type="button"
          onClick={handleGoogle}
          disabled={loading}
          variant="outline"
          size="lg"
          className="w-full rounded-xl h-12 mb-4 gap-2.5 border-hairline bg-background hover:bg-muted/40"
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

          <AnimatePresence mode="wait">
            <TabsContent key={mode} value={mode} className="mt-6" forceMount>
              <motion.form
                key={mode}
                onSubmit={handleEmail}
                initial={{ opacity: 0, x: mode === "signin" ? -8 : 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: mode === "signin" ? 8 : -8 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                {mode === "signup" && (
                  <Field label="Full name" value={fullName} onChange={setFullName} autoComplete="name" />
                )}
                <Field label="Email" value={email} onChange={setEmail} type="email" autoComplete="email" />
                <PasswordField
                  value={password}
                  onChange={setPassword}
                  visible={showPassword}
                  onToggle={() => setShowPassword((v) => !v)}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                />
                {mode === "signup" && (
                  <label className="flex items-start gap-2.5 pt-1 cursor-pointer">
                    <Checkbox checked={agreed} onCheckedChange={(v) => setAgreed(!!v)} className="mt-0.5" />
                    <span className="text-xs text-muted-foreground leading-relaxed">
                      I agree to Petos's{" "}
                      <Link to="/legal/terms" className="underline text-foreground">Terms</Link>{" "}
                      and{" "}
                      <Link to="/legal/privacy" className="underline text-foreground">Privacy Policy</Link>.
                    </span>
                  </label>
                )}
                <Button
                  type="submit"
                  disabled={loading}
                  size="lg"
                  className="w-full rounded-xl h-12 bg-gradient-to-r from-primary to-coral hover:opacity-95 text-primary-foreground shadow-lg shadow-primary/20"
                >
                  {loading
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : mode === "signin" ? "Sign in" : "Create account"}
                </Button>
                {mode === "signin" && (
                  <div className="text-center">
                    <Link to="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline">
                      Forgot password?
                    </Link>
                  </div>
                )}
              </motion.form>
            </TabsContent>
          </AnimatePresence>
        </Tabs>

        </motion.div>

        {/* Trust badges */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-6 flex items-center justify-center gap-4 text-[11px] text-muted-foreground"
        >
          <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Secure</span>
          <span className="h-3 w-px bg-hairline" />
          <span className="inline-flex items-center gap-1"><Sparkles className="h-3 w-3" /> Free to join</span>
        </motion.div>

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

const PasswordField = ({ value, onChange, visible, onToggle, autoComplete }: {
  value: string; onChange: (v: string) => void; visible: boolean; onToggle: () => void; autoComplete?: string;
}) => (
  <div className="space-y-1.5">
    <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Password</Label>
    <div className="relative">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        className="h-12 rounded-xl border-hairline bg-card pr-11"
      />
      <button
        type="button"
        onClick={onToggle}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  </div>
);

export default Auth;
