import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSession } from "@/hooks/use-session";
import { buildGitHubLoginUrl } from "@/lib/auth";

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
                Fast to scan for recruiters. Clear to build for candidates.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">Manual mapping</Badge>
              <Badge variant="outline">Verifiable links</Badge>
              <Badge variant="outline">Shareable packet</Badge>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {isAuthenticated ? (
              <>
                <Card className="border-slate-800/80 bg-slate-900/40">
                  <CardContent className="space-y-2 p-4">
                    <p className="text-sm text-slate-300">Hi {user?.githubLogin}</p>
                    <p className="text-lg font-medium text-white">Create your next packet</p>
                    <Button className="w-full" asChild>
                      <Link to="/jobs/new">New packet</Link>
                    </Button>
                  </CardContent>
                </Card>
                <Card className="border-slate-800/80 bg-slate-900/40">
                  <CardContent className="space-y-2 p-4">
                    <p className="text-sm text-slate-300">Update your evidence pool</p>
                    <p className="text-lg font-medium text-white">Projects</p>
                    <Button variant="outline" className="w-full" asChild>
                      <Link to="/projects">Manage projects</Link>
                    </Button>
                  </CardContent>
                </Card>
                <Card className="border-slate-800/80 bg-slate-900/40">
                  <CardContent className="space-y-2 p-4">
                    <p className="text-sm text-slate-300">Track your applications</p>
                    <p className="text-lg font-medium text-white">Jobs</p>
                    <Button variant="outline" className="w-full" asChild>
                      <Link to="/jobs">Open tracker</Link>
                    </Button>
                  </CardContent>
                </Card>
              </>
            ) : (
              <>
                <Card className="border-slate-800/80 bg-slate-900/40">
                  <CardContent className="space-y-2 p-4">
                    <p className="text-sm text-slate-300">Candidate</p>
                    <p className="text-lg font-medium text-white">Build your packet</p>
                    <Button className="w-full" onClick={handleGitHubLogin}>
                      Sign in with GitHub
                    </Button>
                  </CardContent>
                </Card>
                <Card className="border-slate-800/80 bg-slate-900/40">
                  <CardContent className="space-y-2 p-4">
                    <p className="text-sm text-slate-300">Start with projects</p>
                    <p className="text-lg font-medium text-white">Connect evidence</p>
                    <Button variant="outline" className="w-full" onClick={handleGitHubLogin}>
                      Open projects
                    </Button>
                  </CardContent>
                </Card>
                <Card className="border-slate-800/80 bg-slate-900/40">
                  <CardContent className="space-y-2 p-4">
                    <p className="text-sm text-slate-300">Recruiter</p>
                    <p className="text-lg font-medium text-white">Skim packet format</p>
                    <Button variant="outline" className="w-full" asChild>
                      <Link to="/security">Review trust model</Link>
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
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Action checklist</p>
            <div className="space-y-2 text-sm text-slate-200">
              <p>1. Add projects with context.</p>
              <p>2. Add job requirements you want to prove.</p>
              <p>3. Map each requirement to links and samples.</p>
              <p>4. Share one packet link with your resume.</p>
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
