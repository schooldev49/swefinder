import type { PropsWithChildren } from "react";
import { Loader2 } from "lucide-react";
import { Navigate, useLocation } from "react-router-dom";
import { useSession } from "@/hooks/use-session";

export function ProtectedRoute({ children }: PropsWithChildren) {
  const { data: user, isLoading } = useSession();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    const nextPath = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/?next=${encodeURIComponent(nextPath)}`} replace />;
  }

  return <>{children}</>;
}
