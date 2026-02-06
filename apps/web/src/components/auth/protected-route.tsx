import type { PropsWithChildren } from "react";
import { Loader2 } from "lucide-react";
import { useSession } from "@/hooks/use-session";

export function ProtectedRoute({ children }: PropsWithChildren) {
  const { isLoading } = useSession();

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <>{children}</>;
}
