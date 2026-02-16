import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function PublicShareLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-white">
      <header className="border-b border-slate-900/80 bg-slate-950/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link to="/" className="text-lg font-semibold tracking-tight">
            Evidensify
          </Link>
          <Button asChild size="sm" variant="secondary">
            <Link to="/">Create your profile</Link>
          </Button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-6 py-10">{children}</main>
      <footer className="mx-auto max-w-5xl px-6 pb-10 text-xs text-muted-foreground">
        Built for evidence-first applications. Links open in new tabs.
      </footer>
    </div>
  );
}
