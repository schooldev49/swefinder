import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
      "Build a public proof profile and optional job-specific packets with verifiable links to public repos, docs, and commits.",
    path: "/",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Evidensify",
      url: typeof window !== "undefined" ? window.location.origin : "https://evidensify.com",
      description:
        "Public proof profiles and optional job-specific packets for fast technical verification.",
    },
  });

  const handleProfileLogin = () => {
    window.location.href = buildGitHubLoginUrl(nextPath || "/profile");
  };

  const handleOptionalPacketLogin = () => {
    window.location.href = buildGitHubLoginUrl("/jobs/new");
  };

  return (
    <div className="py-6">
      {isAuthenticated ? (
        <section className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="grid gap-3 md:grid-cols-3">
            <Card className="border-slate-800/80 bg-slate-900/40 md:col-span-2">
              <CardContent className="space-y-3 p-5">
                <p className="text-sm text-slate-300">Hi {user?.githubLogin}</p>
                <h1 className="text-2xl font-semibold text-white sm:text-3xl">Build your public proof profile</h1>
                <p className="text-sm text-slate-300">Start with a reusable profile link. Add job-specific packets only when needed.</p>
                <div className="grid gap-2 text-xs text-slate-300 sm:grid-cols-3">
                  <div className="rounded-lg border border-slate-800/80 bg-slate-950/60 px-3 py-2">
                    <p className="text-slate-500">Projects added</p>
                    <p className="text-base font-semibold text-white">{projects.length}</p>
                  </div>
                  <div className="rounded-lg border border-slate-800/80 bg-slate-950/60 px-3 py-2">
                    <p className="text-slate-500">Jobs tracked</p>
                    <p className="text-base font-semibold text-white">{jobs.length}</p>
                  </div>
                  <div className="rounded-lg border border-slate-800/80 bg-slate-950/60 px-3 py-2">
                    <p className="text-slate-500">Proof ready</p>
                    <p className="text-base font-semibold text-white">
                      {jobs.filter((job) => job.status === "PROOF_GENERATED" || job.status === "APPLIED" || job.status === "INTERVIEW" || job.status === "OFFER").length}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button className="w-full sm:w-auto" asChild>
                    <Link to="/profile">Build public profile</Link>
                  </Button>
                  <Button variant="outline" className="w-full sm:w-auto" asChild>
                    <Link to="/jobs/new">Create optional job packet</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
            <Card className="border-slate-800/80 bg-slate-900/40">
              <CardContent className="space-y-2 p-4">
                <p className="text-sm text-slate-300">Quick actions</p>
                <Button variant="outline" className="w-full" asChild>
                  <Link to="/projects">Add evidence from projects</Link>
                </Button>
                <Button variant="outline" className="w-full" asChild>
                  <Link to="/jobs">Import job description</Link>
                </Button>
                <Button variant="outline" className="w-full" asChild>
                  <Link to="/example-packet">See example packet</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>
      ) : (
        <section className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <Card className="border-slate-800/80 bg-slate-950/70">
              <CardContent className="space-y-4 p-6">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Evidensify</p>
                <h1 className="text-3xl font-semibold text-white sm:text-4xl">Build a public proof profile</h1>
                <p className="text-sm text-slate-300">Start with your public proof profile. Add job-specific packets only when needed.</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">Manual mapping</Badge>
                  <Badge variant="outline">Public-only links</Badge>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button className="w-full sm:w-auto" onClick={handleProfileLogin}>
                    Build public profile
                  </Button>
                  <Button variant="outline" className="w-full sm:w-auto" onClick={handleOptionalPacketLogin}>
                    Create job packet (optional)
                  </Button>
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-2xl border-slate-800/80 bg-slate-950/80 shadow-xl">
              <CardContent className="space-y-4 p-4 sm:p-5">
                <p className="text-sm text-slate-400">Proof Packet preview</p>
                <div className="space-y-3">
                  {previewRequirements.map((req) => (
                    <div key={req.title} className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-3 text-sm">
                      <p className="font-medium text-slate-100">{req.title}</p>
                      <p className="text-xs text-slate-400">{req.evidence}</p>
                      <p className="mt-1 break-all text-[10px] uppercase tracking-[0.3em] text-slate-500">{req.cite}</p>
                      <p className="mt-1 text-xs text-slate-300">{req.note}</p>
                    </div>
                  ))}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button variant="outline" asChild>
                    <Link to="/example-packet">See example packet</Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link to="/security">How verification works</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      )}

      <section className="mx-auto mt-6 grid w-full max-w-6xl gap-6 px-4 sm:px-6 md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <Card className="border-slate-800/80 bg-slate-950/70">
          <CardContent className="space-y-3 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">How mapping works</p>
            <div className="space-y-2 text-sm text-slate-200">
              <p className="rounded-lg border border-slate-800/80 bg-slate-950/60 px-3 py-2">Project</p>
              <p className="rounded-lg border border-slate-800/80 bg-slate-950/60 px-3 py-2">Requirement</p>
              <p className="rounded-lg border border-slate-800/80 bg-slate-950/60 px-3 py-2">Linked evidence</p>
              <p className="pt-1 text-xs text-slate-400">Attach one packet link with your resume.</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-slate-800/80 bg-slate-950/80 shadow-xl">
          <CardContent className="space-y-4 p-4 sm:p-5">
            <p className="text-sm text-slate-400">Action summary</p>
            <div className="space-y-3">
              <p className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-3 text-sm text-slate-200">Only public links are allowed in Proof Packets.</p>
              <p className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-3 text-sm text-slate-200">Candidates choose requirements and evidence manually.</p>
              <p className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-3 text-sm text-slate-200">Recruiters can skim fast and verify source links directly.</p>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
