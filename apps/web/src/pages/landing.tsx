import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSession } from "@/hooks/use-session";
import { buildGitHubLoginUrl } from "@/lib/auth";
import { fetchJobs, fetchProjects } from "@/lib/api";

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

  const handleGitHubLogin = () => {
    window.location.href = buildGitHubLoginUrl(nextPath || "/projects");
  };

  return (
    <div className="py-6">
      <section className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="rounded-2xl border border-slate-800/70 bg-slate-950/70 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Evidensify</p>
              <h1 className="mt-2 text-3xl font-semibold text-white sm:text-4xl">Requirement-first Proof Packets</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">
                Build a role-specific packet that maps requirements to verifiable project evidence.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">Manual mapping</Badge>
              <Badge variant="outline">Verifiable links</Badge>
                          </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {isAuthenticated ? (
              <>
                <Card className="border-slate-800/80 bg-slate-900/40 md:col-span-2">
                  <CardContent className="space-y-2 p-4">
                    <p className="text-sm text-slate-300">Hi {user?.githubLogin}</p>
                    <p className="text-lg font-medium text-white">Create your next packet</p>
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
                    <Button className="w-full sm:w-auto" asChild>
                      <Link to="/jobs/new">New packet</Link>
                    </Button>
                  </CardContent>
                </Card>
                <Card className="border-slate-800/80 bg-slate-900/40">
                  <CardContent className="space-y-2 p-4">
                    <p className="text-sm text-slate-300">Quick actions</p>
                    <p className="text-lg font-medium text-white">Keep moving</p>
                    <Button variant="outline" className="w-full" asChild>
                      <Link to="/projects">Add evidence from projects</Link>
                    </Button>
                    <Button variant="outline" className="w-full" asChild>
                      <Link to="/jobs">Import job description</Link>
                    </Button>
                  </CardContent>
                </Card>
              </>
            ) : (
              <>
                <Card className="border-slate-800/80 bg-slate-900/40 md:col-span-2">
                  <CardContent className="space-y-2 p-4">
                    <p className="text-sm text-slate-300">Candidate</p>
                    <p className="text-lg font-medium text-white">Build your proof packet</p>
                    <div className="space-y-1 text-sm text-slate-300">
                      <p>Prove requirements with project evidence.</p>
                      <p>Used to support claims like experiment design, production UI, and evaluation tooling.</p>
                    </div>
                    <Button className="w-full sm:w-auto" onClick={handleGitHubLogin}>
                      Build your proof packet
                    </Button>
                  </CardContent>
                </Card>
                <Card className="border-slate-800/80 bg-slate-900/40">
                  <CardContent className="space-y-2 p-4">
                    <p className="text-sm text-slate-300">Learn quickly</p>
                    <p className="text-lg font-medium text-white">Before you sign in</p>
                    <Button variant="outline" className="w-full" asChild>
                      <Link to="/example-packet">See example packet</Link>
                    </Button>
                    <Button variant="outline" className="w-full" asChild>
                      <Link to="/security">How verification works</Link>
                    </Button>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      </section>

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
            <p className="text-xs text-slate-400">Each claim links to a file path, README, or commit.</p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
