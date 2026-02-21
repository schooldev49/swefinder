import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useSession } from "@/hooks/use-session";
import { buildGitHubLoginUrl } from "@/lib/auth";
import { fetchJobs, fetchProjects } from "@/lib/api";
import { useSEO } from "@/lib/seo";

const previewRequirements = [
  {
    title: "Design ML experiments and communicate findings",
    evidence: "ml-research-notebooks",
    cite: "src/eval/metrics.py#L42-L86",
    note: "Typed evaluation helper with guardrails and metrics logging.",
  },
  {
    title: "Ship production-ready real-time UI",
    evidence: "realtime-collab-board",
    cite: "src/hooks/useRoom.ts#L12-L37",
    note: "CRDT session hook with connection state tracking.",
  },
];

export function LandingPage() {
  const location = useLocation();
  const { data: user } = useSession();
  const isAuthenticated = Boolean(user);
  const { data: projects = [] } = useQuery({
    queryKey: ["projects", "landing"],
    queryFn: fetchProjects,
    enabled: isAuthenticated,
  });
  const { data: jobs = [] } = useQuery({
    queryKey: ["jobs", "landing"],
    queryFn: fetchJobs,
    enabled: isAuthenticated,
  });
  const nextParam = new URLSearchParams(location.search).get("next");
  const nextPath = nextParam && nextParam.startsWith("/") ? nextParam : undefined;
  useSEO({
    title: "Public proof profiles for hiring",
    description:
      "Build a public proof profile with verifiable links to public repos, docs, and commits.",
    path: "/",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Evidensify",
      url: typeof window !== "undefined" ? window.location.origin : "https://evidensify.com",
      description:
        "Public proof profiles for fast technical verification.",
    },
  });

  const handleProjectsLogin = () => {
    window.location.href = buildGitHubLoginUrl(nextPath || "/projects");
  };

  return (
    <div className="py-4 sm:py-6">
      {isAuthenticated ? (
        <section className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="grid gap-3 md:grid-cols-3">
            <Card className="md:col-span-2">
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">Hi {user?.githubLogin}</p>
                <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">Your proof profile workspace</h1>
                <p className="text-base text-muted-foreground">Keep projects current, feature your strongest proof, and share one public link.</p>
                <div className="grid gap-2 text-sm text-foreground sm:grid-cols-3">
                  <div className="rounded-md border border-border bg-background px-3 py-2">
                    <p className="text-muted-foreground">Projects</p>
                    <p className="text-base font-semibold text-foreground">{projects.length}</p>
                  </div>
                  <div className="rounded-md border border-border bg-background px-3 py-2">
                    <p className="text-muted-foreground">Jobs tracked</p>
                    <p className="text-base font-semibold text-foreground">{jobs.length}</p>
                  </div>
                  <div className="rounded-md border border-border bg-background px-3 py-2">
                    <p className="text-muted-foreground">Proof ready</p>
                    <p className="text-base font-semibold text-foreground">
                      {jobs.filter((job) => job.status === "PROOF_GENERATED" || job.status === "APPLIED" || job.status === "INTERVIEW" || job.status === "OFFER").length}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Button asChild>
                    <Link to="/projects">Create proof profile</Link>
                  </Button>
                </div>
                <div className="rounded-xl border border-border bg-background/70 p-3 text-sm">
                  <p className="font-medium text-foreground">Where to use your link</p>
                  <div className="mt-2 grid gap-1 text-muted-foreground sm:grid-cols-3">
                    <p>Resume</p>
                    <p>Portfolio field</p>
                    <p>Outreach</p>
                  </div>
                  <p className="mt-2 text-muted-foreground">
                    GitHub: <span className="text-foreground">github.com/{user?.githubLogin || "username"}</span> {"  "}
                    Proof: <span className="text-foreground">evidensify.com/u/{user?.profileSlug || "handle"}</span>
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">Quick actions</p>
                <Button variant="outline" className="w-full" asChild>
                  <Link to="/projects">Add evidence from projects</Link>
                </Button>
                <Button variant="outline" className="w-full" asChild>
                  <Link to="/projects#external">Add external project</Link>
                </Button>
                <Button variant="outline" className="w-full" asChild>
                  <Link to="/example-packet">See example profile</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>
      ) : (
        <section className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
            <Card>
              <CardContent className="space-y-4">
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Evidensify</p>
                <h1 className="text-3xl font-semibold text-foreground sm:text-4xl">Cut through resume noise. Show code recruiters can verify.</h1>
                <p className="text-base text-muted-foreground">One link on your resume. Public evidence recruiters can verify fast.</p>
                <div className="rounded-xl border border-border bg-background/70 p-3">
                  <p className="text-sm font-medium text-foreground">Manual proof only</p>
                  <p className="mt-1 text-sm text-muted-foreground">No auto-generated claims. You choose what to share.</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="rounded-full border border-border bg-card px-2 py-0.5 text-xs text-muted-foreground">Public repos</span>
                    <span className="rounded-full border border-border bg-card px-2 py-0.5 text-xs text-muted-foreground">README excerpts</span>
                    <span className="rounded-full border border-border bg-card px-2 py-0.5 text-xs text-muted-foreground">Commit trails</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleProjectsLogin}>Create proof profile</Button>
                  <Button variant="outline" asChild>
                    <Link to="/example-packet">See example profile</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">Profile preview</p>
                {previewRequirements.map((req) => (
                  <div key={req.title} className="rounded-md border border-border bg-background p-3 text-sm">
                    <p className="font-medium text-foreground">{req.title}</p>
                    <p className="text-xs text-muted-foreground">{req.evidence}</p>
                    <p className="mt-1 break-all text-[10px] uppercase tracking-[0.3em] text-muted-foreground">{req.cite}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{req.note}</p>
                  </div>
                ))}
                <Button variant="outline" className="w-full" asChild>
                  <Link to="/security">How verification works</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>
      )}
    </div>
  );
}
