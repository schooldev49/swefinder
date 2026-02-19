import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
};

type State = {
  hasError: boolean;
};

export class PostHogErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (typeof window !== "undefined" && window.posthog) {
      window.posthog.capture("$exception", {
        source: "react_error_boundary",
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
      });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="rounded-2xl border border-border bg-card/85 p-6 text-sm text-muted-foreground">
            Something went wrong while rendering this page.
          </div>
        )
      );
    }
    return this.props.children;
  }
}
