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

export function AppLayout() {
  const { data: user, isLoading } = useSession();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isAuthenticated = Boolean(user);
  const hasPublicProfile = Boolean(user?.profileSlug);
  const profilePreviewPath = hasPublicProfile ? `/u/${user?.profileSlug}` : "/profile";
  const navLinks = [
    { id: "profile", to: profilePreviewPath, label: "Profile" },
    { id: "projects", to: "/projects", label: "Projects" },
    ...(hasPublicProfile ? [{ id: "settings", to: "/profile", label: "Settings" }] : []),
  ];

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
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 pb-10 pt-4 sm:px-6">
        <header className="sticky top-3 z-30 rounded-xl border border-border bg-card/95 px-4 py-3 backdrop-blur sm:px-6 sm:py-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center justify-between gap-3">
              <img src="/Evidensify.png" alt="Evidensify logo" className="h-8 w-8" />
              <Link to="/" className="text-lg font-semibold tracking-tight text-foreground">
                Evidensify
              </Link>
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white md:hidden"
                onClick={() => setIsMenuOpen((open) => !open)}
                aria-label={isMenuOpen ? "Close navigation" : "Open navigation"}
              >
                {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
            <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
              {navLinks.map((link) => (
                <NavLink
                  key={link.id}
                  to={link.to}
                  className={({ isActive }) =>
                    cn("transition-colors hover:text-foreground", isActive ? "text-foreground" : "text-muted-foreground")
                  }
                >
                  {link.label}
                </NavLink>
              ))}
            </nav>
            <div className="flex items-center gap-3">
              {isLoading ? (
                <div className="h-8 w-28 animate-pulse rounded-full bg-muted" />
              ) : isAuthenticated && user ? (
                <div className="flex items-center gap-3">
                  <p className="hidden text-sm text-muted-foreground md:block">Hi {user.githubLogin}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLogout}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Log out
                  </Button>
                  <NavLink to="/projects" className="hidden md:block">
                    <Button size="sm">Workspace</Button>
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
                  key={link.id}
                  to={link.to}
                  className={({ isActive }) =>
                    cn("rounded-md px-3 py-2 transition-colors hover:bg-accent hover:text-foreground", isActive ? "bg-accent text-foreground" : "text-muted-foreground")
                  }
                  onClick={() => setIsMenuOpen(false)}
                >
                  {link.label}
                </NavLink>
              ))}
              {isAuthenticated ? (
                <NavLink
                  to="/projects"
                  className="rounded-md px-3 py-2 text-left text-foreground transition-colors hover:bg-accent md:hidden"
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
        <footer className="px-1 pb-1 text-xs text-muted-foreground">
          Evidensify is an independent tool. GitHub is a trademark of GitHub, Inc.
        </footer>
      </div>
    </div>
  );
}
