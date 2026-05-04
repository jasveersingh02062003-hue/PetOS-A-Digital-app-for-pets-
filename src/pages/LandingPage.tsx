import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Shield, Zap, Heart, Search, Globe, Smartphone } from "lucide-react";
import { PetosLogo } from "@/components/PetosLogo";

export const LandingPage = () => {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Hero Section */}
      <header className="px-4 lg:px-6 h-14 flex items-center border-b border-hairline">
        <Link className="flex items-center justify-center gap-2" to="/">
          <PetosLogo className="h-6 w-auto text-primary" />
          <span className="font-display font-bold text-lg">Petos</span>
        </Link>
        <nav className="ml-auto flex gap-4 sm:gap-6 items-center">
          <Link className="text-sm font-medium hover:underline underline-offset-4" to="/breeds">
            Breeds
          </Link>
          <Link className="text-sm font-medium hover:underline underline-offset-4" to="/discover">
            Marketplace
          </Link>
          <Button variant="ghost" asChild size="sm">
            <Link to="/auth">Sign In</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/auth">Join Now</Link>
          </Button>
        </nav>
      </header>

      <main className="flex-1">
        {/* Visual Hero */}
        <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48 bg-muted/30">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="space-y-2">
                <h1 className="text-4xl font-display font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl">
                  A complete digital life for <span className="text-primary">your pet</span>.
                </h1>
                <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                  The Amazon of Pet Care. From AI health tracking and verified breeders to 24/7 emergency support. All in one unified ecosystem.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <Button size="lg" className="px-8 rounded-full shadow-lg shadow-primary/20" asChild>
                  <Link to="/find-my-pet">Get Started Free</Link>
                </Button>
                <Button size="lg" variant="outline" className="px-8 rounded-full" asChild>
                  <Link to="/how-it-works">Watch Demo</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="w-full py-12 md:py-24 lg:py-32 bg-background">
          <div className="container px-4 md:px-6">
            <div className="grid gap-12 lg:grid-cols-3">
              <div className="flex flex-col items-center space-y-4 text-center">
                <div className="p-4 bg-primary/10 rounded-2xl">
                  <Shield className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold">Verified Marketplace</h3>
                <p className="text-muted-foreground">
                  Connect with verified breeders, vets, and service providers. Trust and safety are built into every interaction.
                </p>
              </div>
              <div className="flex flex-col items-center space-y-4 text-center">
                <div className="p-4 bg-coral/10 rounded-2xl">
                  <Heart className="h-8 w-8 text-coral" />
                </div>
                <h3 className="text-xl font-bold">Smart Health Vault</h3>
                <p className="text-muted-foreground">
                  Track medical history, vaccinations, and daily vitals. Share instantly with vets via secure QR codes.
                </p>
              </div>
              <div className="flex flex-col items-center space-y-4 text-center">
                <div className="p-4 bg-blue-500/10 rounded-2xl">
                  <Zap className="h-8 w-8 text-blue-500" />
                </div>
                <h3 className="text-xl font-bold">AI Companion</h3>
                <p className="text-muted-foreground">
                  24/7 AI Triage and behavioral support. Instant answers for your pet's wellness, anytime, anywhere.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Device Sync Section */}
        <section className="w-full py-12 md:py-24 lg:py-32 bg-muted/50 overflow-hidden relative">
          <div className="container px-4 md:px-6 relative z-10">
            <div className="grid gap-10 lg:grid-cols-2 items-center">
              <div className="space-y-4">
                <div className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                  Dual-Mode Experience
                </div>
                <h2 className="text-3xl font-display font-bold tracking-tighter md:text-4xl/tight">
                  The Power of a Web Dashboard. The Ease of a Mobile App.
                </h2>
                <p className="text-muted-foreground md:text-lg/relaxed">
                  Manage your professional listings from your desktop, and track your pet's daily walks from your phone. Your data stays perfectly synced across all surfaces.
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-primary" />
                    <strong>Web Dashboard:</strong> No forced onboarding. Direct marketplace access.
                  </li>
                  <li className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-primary" />
                    <strong>Installed App:</strong> Mandatory onboarding for a guided pet-parent experience.
                  </li>
                </ul>
              </div>
              <div className="flex justify-center lg:justify-end">
                <div className="relative w-[280px] h-[580px] bg-black rounded-[3rem] border-[8px] border-zinc-800 shadow-2xl overflow-hidden ring-4 ring-zinc-900/50">
                  <div className="absolute top-0 inset-x-0 h-6 bg-black flex items-center justify-center">
                    <div className="w-20 h-4 bg-zinc-900 rounded-full" />
                  </div>
                  <div className="w-full h-full bg-background p-4 flex flex-col justify-center items-center text-center">
                    <PetosLogo className="h-12 w-auto text-primary mb-4" />
                    <p className="font-display font-bold text-lg mb-2">Petos App</p>
                    <div className="w-full h-24 bg-muted rounded-xl mb-4 animate-pulse" />
                    <div className="w-3/4 h-4 bg-muted rounded-full mb-2 animate-pulse" />
                    <div className="w-1/2 h-4 bg-muted rounded-full animate-pulse" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="flex flex-col gap-2 sm:flex-row py-6 w-full shrink-0 items-center px-4 md:px-6 border-t border-hairline bg-background">
        <p className="text-xs text-muted-foreground">© 2026 Petos Buddy Club. All rights reserved.</p>
        <nav className="sm:ml-auto flex gap-4 sm:gap-6">
          <Link className="text-xs hover:underline underline-offset-4" to="/legal/terms">Terms of Service</Link>
          <Link className="text-xs hover:underline underline-offset-4" to="/legal/privacy">Privacy</Link>
        </nav>
      </footer>
    </div>
  );
};
