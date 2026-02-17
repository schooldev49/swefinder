import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSession } from "@/hooks/use-session";
import { buildGitHubLoginUrl } from "@/lib/auth";
import { logout } from "@/lib/api";
import { capturePageView, identifyPostHogUser, resetPostHogUser } from "@/lib/analytics";
import { PostHogErrorBoundary } from "@/components/analytics/posthog-error-boundary";
import { cn } from "@/lib/utils";
const navLinks = [
  { to: "/profile", label: "Profile" },
  { to: "/projects", label: "Projects" },
];

export function AppLayout() {
  const { data: user, isLoading } = useSession();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isAuthenticated = Boolean(user);

  useEffect(() => {
    capturePageView(`${location.pathname}${location.search}`);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (isLoading) return;
    if (user) {
      identifyPostHogUser(user);
      return;
    }
    resetPostHogUser();
  }, [isLoading, user]);

  const handleLogin = () => {
    window.location.href = buildGitHubLoginUrl("/projects");
  };

  const handleLogout = async () => {
    await logout();
    await queryClient.invalidateQueries({ queryKey: ["session"] });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 pb-10 pt-6 sm:px-6">
        <header className="rounded-2xl border border-slate-800/80 bg-slate-900/50 px-6 py-4 backdrop-blur">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center justify-between gap-3">
              <img src="/Evidensify.png" alt="Evidensify logo" className="h-8 w-8" />
              <Link to="/" className="text-lg font-semibold tracking-tight text-white">
                Evidensify
              </Link>
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/60 text-muted-foreground transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white md:hidden"
                onClick={() => setIsMenuOpen((open) => !open)}
                aria-label={isMenuOpen ? "Close navigation" : "Open navigation"}
              >
                {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
            <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
              {navLinks.map((link) => (
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
              ) : isAuthenticated && user ? (
                <div className="flex items-center gap-3">
                  <p className="hidden text-sm text-slate-300 md:block">Hi {user.githubLogin}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLogout}
                    className="text-muted-foreground hover:text-white"
                  >
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
          </div>
          {isMenuOpen ? (
            <nav className="mt-4 flex flex-col gap-1 text-sm font-medium text-muted-foreground md:hidden">
              {navLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) =>
                    cn(
                      "rounded-xl px-3 py-2 transition-colors hover:bg-slate-800 hover:text-white",
                      isActive ? "bg-slate-800 text-white" : "text-muted-foreground"
                    )
                  }
                  onClick={() => setIsMenuOpen(false)}
                >
                  {link.label}
                </NavLink>
              ))}
              {isAuthenticated ? (
                <NavLink
                  to="/projects"
                  className="rounded-xl px-3 py-2 text-left text-white transition-colors hover:bg-slate-800 md:hidden"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Go to dashboard
                </NavLink>
              ) : null}
            </nav>
          ) : null}
        </header>
        <main className="flex-1">
          <PostHogErrorBoundary>
            <Outlet />
          </PostHogErrorBoundary>
        </main>
      </div>
    </div>
  );
}
