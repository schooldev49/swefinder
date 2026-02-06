import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, CheckCircle, Code2, FileText, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSession } from "@/hooks/use-session";
import { buildGitHubLoginUrl } from "@/lib/auth";
import { setDemoPreference } from "@/demo/mode";

const steps = [
  { title: "Connect GitHub", body: "Securely pull the repos, PRs, and notebooks that prove your skills.", icon: Code2 },
  { title: "Paste the JD", body: "Highlight the requirements that actually matter for this role.", icon: FileText },
  { title: "Generate Proof", body: "Get tailored bullets, evidence links, and an outreach note with one click.", icon: Sparkles },
];

const trustPoints = [
  "Requirements mapped to specific repo paths or demos.",
  "User-provided metrics stay labeled and auditable.",
  "Proof Packet supplements — never replaces — your résumé.",
  "Every packet is manually curated before sending.",
];

const previewRequirements = [
  { title: "Prototype ML experiments", project: "ml-research-notebooks", link: "Repo README", cite: "ml-research-notebooks/train.py" },
  { title: "Ship real-time collaboration UI", project: "realtime-collab-board", link: "Live demo", cite: "realtime-collab-board/src/hooks/useRoom.ts" },
];

const previewBullets = [
  "Fine-tuned a RoBERTa toxicity classifier (94% F1) with HF Accelerate and tracked results in W&B.",
  "Built a WebRTC board with CRDT sync so reviewers annotate experiments together.",
];

const previewCitations = [
  {
    label: "ml-research-notebooks/train.py",
    note: "Logging F1 + latency for each RoBERTa run.",
    href: "https://github.com/demo-student/ml-research-notebooks/blob/main/train.py",
  },
  {
    label: "realtime-collab-board/src/hooks/useRoom.ts",
    note: "CRDT sync logic for WebRTC board reviewers.",
    href: "https://github.com/demo-student/realtime-collab-board/blob/main/src/hooks/useRoom.ts",
  },
];

export function LandingPage() {
  const { data: user } = useSession();
  const isAuthenticated = Boolean(user);

  const primaryCta = isAuthenticated ? (
    <Button asChild size="lg">
      <Link to="/projects">
        Go to dashboard <ArrowRight className="ml-2 h-4 w-4" />
      </Link>
    </Button>
  ) : (
    <Button
      size="lg"
      className="inline-flex items-center gap-2 bg-white text-slate-900 hover:bg-slate-100"
      onClick={() => (window.location.href = buildGitHubLoginUrl())}
    >
      <GitHubMark className="h-4 w-4" />
      Sign in with GitHub
    </Button>
  );

  return (
    <div className="space-y-20 py-4">
      <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 py-20 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="space-y-7">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            <ShieldCheck className="h-4 w-4" /> Evidence-first job packets
          </div>
          <div className="space-y-4">
            <h1 className="text-4xl font-semibold leading-tight text-white md:text-5xl">
              Turn your GitHub projects into proof employers trust.
            </h1>
            <p className="text-base text-slate-300 md:text-lg">
              ProofCraft maps your real commits and demos to each requirement, then generates JD-ready bullets and a proof sheet you can attach in seconds.
            </p>
            <p className="text-sm text-slate-400">Built for CS, SWE, and ML applicants who already have projects and want a verifier, not a résumé spinner.</p>
            <p className="text-sm text-slate-400">You pick the repos, confirm every claim, and send a curated packet instead of a generic blast.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            {primaryCta}
            <Button
              asChild
              variant="outline"
              size="lg"
              className="border-slate-700 text-slate-100 hover:bg-slate-800/80"
            >
              <Link
                to="/jobs/job-demo?demo=1"
                onClick={() => {
                  setDemoPreference(true);
                }}
              >
                See example packet
              </Link>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            No résumés rewritten, no mass applying — just one GitHub login and evidence you can send to recruiters.
          </p>
        </div>
        <div className="relative">
          <div className="absolute inset-x-4 top-6 -z-10 rounded-3xl bg-slate-800/30 blur-3xl" aria-hidden="true" />
          <Card className="rounded-3xl border-slate-800/80 bg-slate-950/80 shadow-2xl">
            <CardContent className="space-y-6 p-6">
              <div className="flex items-center justify-between text-sm text-slate-400">
                <span>Proof Packet</span>
                <Badge variant="outline" className="border-slate-700 text-xs">
                  ML Research Intern
                </Badge>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                  <span>Key requirements</span>
                  <Badge variant="outline" className="border-slate-700 text-[10px] uppercase tracking-wide">
                    ML • Realtime
                  </Badge>
                </div>
                <div className="space-y-3">
                  {previewRequirements.map((req) => (
                    <div key={req.title} className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-3 text-sm">
                      <p className="font-medium text-slate-100">{req.title}</p>
                      <p className="text-xs text-slate-400">{req.project}</p>
                      <span className="text-xs text-accent">{req.link}</span>
                      <p className="mt-1 text-[10px] uppercase tracking-[0.3em] text-slate-500">
                        Source <span className="mx-1 text-[11px] font-mono text-slate-300">{req.cite}</span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm font-semibold text-slate-100">
                  <span>Resume bullets</span>
                  <Button variant="ghost" size="sm" className="h-7 px-3 text-xs text-slate-300 hover:text-white">
                    Copy bullets
                  </Button>
                </div>
                <ul className="space-y-2 text-xs text-slate-300">
                  {previewBullets.map((bullet, idx) => (
                    <li key={idx} className="flex items-start gap-2 rounded-lg bg-slate-900/60 p-2">
                      <CheckCircle className="mt-0.5 h-3.5 w-3.5 text-accent" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <EvidenceCitations citations={previewCitations} />
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="border-t border-slate-800/60 bg-slate-950/50">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">How it works</p>
              <h2 className="text-2xl font-semibold text-white">From repo to proof in three steps</h2>
            </div>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {steps.map((step) => (
              <div key={step.title} className="rounded-xl border border-slate-800 bg-slate-950/80 p-5">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <step.icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-white">{step.title}</h3>
                <p className="mt-2 text-sm text-slate-400">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-slate-800 bg-slate-900/40">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-14 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">Hard safety rules</p>
            <h2 className="mt-4 text-3xl font-semibold text-white">Honesty-first by design</h2>
            <p className="mt-3 text-sm text-slate-300">
              No hallucinated metrics. No inflated claims. Every bullet links back to the README, PR, or artifact that proves it, and Proof Packets stay separate from your résumé.
            </p>
          </div>
          <ul className="space-y-4">
            {trustPoints.map((point) => (
              <li key={point} className="flex items-start gap-3 text-sm text-slate-300">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-accent" /> {point}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

function GitHubMark(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <path
        fill="currentColor"
        d="M12 .5C5.65.5.5 5.65.5 12c0 5.09 3.29 9.4 7.86 10.94.58.11.79-.25.79-.56 0-.28-.01-1.03-.02-2.02-3.2.7-3.88-1.54-3.88-1.54-.53-1.36-1.3-1.72-1.3-1.72-1.06-.72.08-.71.08-.71 1.17.08 1.78 1.21 1.78 1.21 1.04 1.78 2.75 1.27 3.42.97.11-.76.41-1.27.74-1.56-2.55-.29-5.23-1.28-5.23-5.72 0-1.26.45-2.29 1.2-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.06 11.06 0 0 1 5.8 0c2.21-1.49 3.18-1.18 3.18-1.18.63 1.59.23 2.76.11 3.05.75.81 1.2 1.84 1.2 3.1 0 4.45-2.69 5.43-5.26 5.71.42.36.79 1.07.79 2.16 0 1.56-.01 2.82-.01 3.2 0 .31.21.68.8.56A10.51 10.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z"
      />
    </svg>
  );
}

function EvidenceCitations({ citations }: { citations: typeof previewCitations }) {
  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold text-slate-100">
        Evidence citations
        <p className="text-[11px] font-normal uppercase tracking-[0.35em] text-slate-500">Links back to repo files</p>
      </div>
      <ul className="space-y-2 text-[11px] text-slate-300">
        {citations.map((citation) => (
          <li key={citation.label} className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-500">{citation.label}</div>
            <p className="text-xs text-slate-200">{citation.note}</p>
            <a href={citation.href} target="_blank" rel="noreferrer" className="text-accent">
              Open file
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
