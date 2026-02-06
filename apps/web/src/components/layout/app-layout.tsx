import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSession } from "@/hooks/use-session";
import { buildGitHubLoginUrl } from "@/lib/auth";
import { logout } from "@/lib/api";
import { cn } from "@/lib/utils";
import { isDemoMode, setDemoPreference } from "@/demo/mode";

const links = [
  { to: "/projects", label: "Projects" },
  { to: "/jobs", label: "Jobs" },
  { to: "/profile", label: "Profile" },
];

export function AppLayout() {
  const { data: user, isLoading } = useSession();
  const queryClient = useQueryClient();
  const location = useLocation();

  const handleLogin = () => {
    window.location.href = buildGitHubLoginUrl(location.pathname);
  };

  const handleLogout = async () => {
    const wasDemo = isDemoMode();
    if (wasDemo) {
      setDemoPreference(false);
    }
    await logout();
    await queryClient.invalidateQueries({ queryKey: ["session"] });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 pb-10 pt-6">
        <header className="flex items-center justify-between rounded-2xl border border-slate-800/80 bg-slate-900/50 px-6 py-4 backdrop-blur">
          <Link to="/" className="text-lg font-semibold tracking-tight text-white">
            ProofCraft
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  cn("transition-colors hover:text-white", isActive ? "text-white" : "text-muted-foreground")
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            {isLoading ? (
              <div className="h-8 w-28 animate-pulse rounded-full bg-slate-800" />
            ) : user ? (
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-white">
                  Log out
                </Button>
                <NavLink to="/projects" className="hidden md:block">
                  <Button size="sm">Dashboard</Button>
                </NavLink>
                <Avatar className="h-10 w-10">
                  <AvatarImage src={user.githubAvatarUrl} alt={user.githubLogin} />
                  <AvatarFallback>{user.githubLogin.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
              </div>
            ) : (
              <Button onClick={handleLogin}>Sign in with GitHub</Button>
            )}
          </div>
        </header>
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
