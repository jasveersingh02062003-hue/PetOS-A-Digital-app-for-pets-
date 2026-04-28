import React from "react";
import { logError } from "@/lib/logError";
import { Button } from "@/components/ui/button";

interface State {
  hasError: boolean;
  message?: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logError(error, {
      source: "client:render",
      meta: { componentStack: info.componentStack?.slice(0, 4000) },
    });
  }

  reset = () => this.setState({ hasError: false, message: undefined });

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-[100dvh] flex items-center justify-center p-6 bg-background">
        <div className="max-w-sm w-full text-center space-y-4">
          <div className="font-display text-2xl">Something went wrong</div>
          <p className="text-sm text-muted-foreground">
            We've logged this and the team has been notified. You can try again or head back home.
          </p>
          <div className="flex gap-2 justify-center pt-2">
            <Button variant="outline" onClick={this.reset}>Try again</Button>
            <Button onClick={() => { this.reset(); window.location.href = "/"; }}>
              Go home
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
