import type { ReactNode } from "react";
import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { capturePageView } from "@/lib/analytics";
import { PostHogErrorBoundary } from "@/components/analytics/posthog-error-boundary";

export function PublicShareLayout({ children }: { children: ReactNode }) {
  const location = useLocation();

  useEffect(() => {
    capturePageView(`${location.pathname}${location.search}`);
  }, [location.pathname, location.search]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <Link to="/" className="text-lg font-semibold tracking-tight">
            Evidensify
          </Link>
          <Button asChild size="sm" variant="secondary">
            <Link to="/">Create your profile</Link>
          </Button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <PostHogErrorBoundary>{children}</PostHogErrorBoundary>
      </main>
      <footer className="mx-auto max-w-5xl px-4 pb-10 text-sm text-muted-foreground sm:px-6">
        Built for evidence-first applications. Links open in new tabs.
      </footer>
    </div>
  );
}
