import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PetosLogo } from "@/components/PetosLogo";
import { useAuth } from "@/hooks/useAuth";
import { Search } from "lucide-react";

export const PublicShell = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="px-4 lg:px-6 h-14 flex items-center border-b border-hairline sticky top-0 z-50 bg-background/80 backdrop-blur-md">
        <Link className="flex items-center justify-center gap-2" to="/">
          <PetosLogo className="h-6 w-auto text-primary" />
          <span className="font-display font-bold text-lg hidden sm:inline-block">Petos</span>
        </Link>
        <nav className="ml-auto flex gap-4 sm:gap-6 items-center">
          <Link className="text-sm font-medium hover:underline underline-offset-4 hidden sm:inline-block" to="/breeds">
            Breeds
          </Link>
          <Link className="text-sm font-medium hover:underline underline-offset-4 hidden sm:inline-block" to="/discover">
            Marketplace
          </Link>
          {user ? (
            <Button asChild size="sm" className="rounded-full">
              <Link to="/dashboard">Dashboard</Link>
            </Button>
          ) : (
            <>
              <Button variant="ghost" asChild size="sm">
                <Link to="/auth">Sign In</Link>
              </Button>
              <Button asChild size="sm" className="rounded-full">
                <Link to="/auth">Join Now</Link>
              </Button>
            </>
          )}
        </nav>
      </header>
      <main className="flex-1">
        {children}
      </main>
      <footer className="flex flex-col gap-2 sm:flex-row py-6 w-full shrink-0 items-center px-4 md:px-6 border-t border-hairline bg-background mt-auto">
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Petos Buddy Club. All rights reserved.</p>
        <nav className="sm:ml-auto flex gap-4 sm:gap-6">
          <Link className="text-xs hover:underline underline-offset-4" to="/legal/terms">Terms of Service</Link>
          <Link className="text-xs hover:underline underline-offset-4" to="/legal/privacy">Privacy</Link>
        </nav>
      </footer>
    </div>
  );
};
