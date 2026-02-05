import type { PropsWithChildren } from "react";
import { Loader2 } from "lucide-react";
import { useSession } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { buildGitHubLoginUrl } from "@/lib/auth";

export function ProtectedRoute({ children }: PropsWithChildren) {
  const { data: user, isLoading } = useSession();

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center">
        <p className="text-lg font-semibold text-white">Sign in required</p>
        <p className="mt-2 text-sm text-muted-foreground">Connect your GitHub account to manage projects and proof packets.</p>
        <Button className="mt-6" onClick={() => (window.location.href = buildGitHubLoginUrl())}>
          Sign in with GitHub
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
