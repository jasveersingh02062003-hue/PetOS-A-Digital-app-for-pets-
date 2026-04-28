import React from "react";
import { logError } from "@/lib/logError";
import { Button } from "@/components/ui/button";

interface State {
  hasError: boolean;
}

/**
 * Per-route error boundary. Catches lazy-chunk load errors and per-page render
 * errors so one broken page doesn't blank the whole app.
 */
export class RouteErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logError(error, {
      source: "client:route",
      meta: { componentStack: info.componentStack?.slice(0, 4000) },
    });
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-[60dvh] grid place-items-center p-6">
        <div className="max-w-sm w-full text-center space-y-3">
          <div className="font-display text-xl">This page failed to load</div>
          <p className="text-sm text-muted-foreground">
            Something went wrong loading this screen. Try reloading.
          </p>
          <div className="flex gap-2 justify-center pt-2">
            <Button variant="outline" onClick={() => this.setState({ hasError: false })}>
              Try again
            </Button>
            <Button onClick={() => window.location.reload()}>Reload</Button>
          </div>
        </div>
      </div>
    );
  }
}
