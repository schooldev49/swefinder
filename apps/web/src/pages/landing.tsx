import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, CheckCircle, ChevronRight, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CodeSnippet } from "@/components/ui/code-snippet";
import { useSession } from "@/hooks/use-session";
import { fetchProjects } from "@/lib/api";
import { cn } from "@/lib/utils";
import { buildGitHubLoginUrl } from "@/lib/auth";

const trustPoints = [
  "Requirements mapped to specific repo paths or demos.",
  "User-provided metrics stay labeled and auditable.",
  "Proof Packet supplements, never replaces, your résumé.",
  "Every packet is manually curated before sending.",
];

const previewRequirements = [
  {
    title: "Design ML experiments and communicate findings",
    project: "ml-research-notebooks",
    link: "Repo README",
    cite: "src/eval/metrics.py#L42-L86",
    snippet: {
      summary: "Typed evaluation helper with guardrails, metrics logging, and failure-case export for auditability.",
      filePath: "src/eval/metrics.py",
      lines: "42-86",
      language: "python",
      code: `def evaluate_model(model: torch.nn.Module, loader: DataLoader) -> dict[str, float]:
    """Run evaluation with guardrails and log audit artifacts."""
    results = evaluate(model, loader)
    if results.total_examples == 0:
        raise ValueError("empty evaluation set")

    metrics = {
        "f1": results.f1,
        "ece": results.ece,
        "latency_ms": results.p95_latency_ms,
    }
    log_metrics(metrics)
    save_failure_cases(results.hard_negatives, "artifacts/failures.csv")
    return metrics`,
    },
  },
  {
    title: "Ship production-ready real-time UIs",
    project: "realtime-collab-board",
    link: "Repo README",
    cite: "src/hooks/useRoom.ts#L12-L37",
    snippet: {
      summary: "CRDT hook that tracks connection state and falls back to cached state on dropouts.",
      filePath: "src/hooks/useRoom.ts",
      lines: "12-37",
      language: "tsx",
      code: `export function useRoom(roomId: string) {
  const [doc] = useState(() => new Y.Doc());
  const [online, setOnline] = useState(false);
  useEffect(() => {
    const provider = new WebrtcProvider(roomId, doc);
    provider.on("status", ({ status }) => setOnline(status === "connected"));
    return () => provider.destroy();
  }, [roomId]);

  return { doc, online };
}`,
    },
  },
];

const previewBullets = [
  "Fine-tuned a RoBERTa toxicity classifier on 1.2M comments, reaching 94% F1 and logging calibration + latency tradeoffs in a reproducible eval notebook.",
  "Built a WebRTC whiteboard with CRDT sync and connection fallback states, enabling 4–6 reviewers to annotate model outputs in real time.",
];

const previewCitations = [
  {
    label: "src/eval/metrics.py#L42-L86",
    note: "Typed evaluation helper that logs metrics and saves failure cases.",
    href: "https://github.com/demo-student/ml-research-notebooks/blob/main/src/eval/metrics.py#L42-L86",
  },
  {
    label: "src/hooks/useRoom.ts#L12-L37",
    note: "CRDT session hook with online/offline state tracking.",
    href: "https://github.com/demo-student/realtime-collab-board/blob/main/src/hooks/useRoom.ts#L12-L37",
  },
];

export function LandingPage() {
  const { data: user } = useSession();
  const isAuthenticated = Boolean(user);
  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
    enabled: isAuthenticated,
    staleTime: 60 * 1000,
  });
  const hasProjects = Boolean(projectsQuery.data && projectsQuery.data.length > 0);
  const handleGitHubLogin = () => {
    window.location.href = buildGitHubLoginUrl("/projects");
  };

  const primaryCta = isAuthenticated
    ? hasProjects
      ? (
          <Button asChild size="lg">
            <Link to="/jobs/new">
              Generate proof packet <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        )
      : (
          <Button asChild size="lg">
            <Link to="/projects">
              Set up projects <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        )
    : (
        <Button
          size="lg"
          onClick={handleGitHubLogin}
          className="inline-flex items-center gap-2 bg-white text-slate-900 hover:bg-slate-100"
        >
          <GitHubMark className="h-4 w-4" />
          Sign in with GitHub
        </Button>
      );

  return (
    <div className="space-y-16 overflow-hidden py-6 sm:space-y-20">
      <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 lg:py-20 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="space-y-7">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            <ShieldCheck className="h-4 w-4" /> Evidence-first job packets
          </div>
          <p className="text-xs uppercase tracking-[0.45em] text-slate-400">Made by students for students</p>
          <div className="space-y-4">
            <h1 className="text-4xl font-semibold leading-tight text-white md:text-5xl">
              Requirement-first packet builder.
            </h1>
            <p className="text-base text-slate-300 md:text-lg">
              Evidensify builds a Proof Packet you send next to your resume. You choose the requirement evidence manually so every claim is traceable.
            </p>
            <p className="text-sm text-slate-400">
              LLM help is optional for requirement extraction and wording polish only. Mapping stays candidate-controlled.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">{primaryCta}</div>
          <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4 text-xs text-slate-200">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Sparkles className="h-4 w-4 text-accent" /> Show how you work with AI
            </div>
            <p className="mt-2">
              Call out tools you used (or note “No AI”) and explain how you supervised the output. Honest detail beats buzzwords when recruiters skim.
            </p>
          </div>
        </div>
        <div className="relative w-full">
          <div className="absolute inset-x-4 top-6 -z-10 rounded-3xl bg-slate-800/30 blur-3xl" aria-hidden="true" />
          <Card className="w-full max-w-xl rounded-3xl border-slate-800/80 bg-slate-950/80 shadow-2xl sm:max-w-none">
            <CardContent className="space-y-6 p-5 sm:p-6">
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
                      <p className="mt-1 break-all text-[10px] uppercase tracking-[0.3em] text-slate-500">
                        Source <span className="mx-1 text-[11px] font-mono text-slate-300">{req.cite}</span>
                      </p>
                      {req.snippet ? <InlineSnippet snippet={req.snippet} /> : null}
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

      <section className="mx-auto max-w-6xl px-4 pb-8 sm:px-6">
        <div className="rounded-3xl border border-slate-800/70 bg-slate-950/60 p-6 shadow-xl shadow-slate-950/30">
          <h2 className="text-2xl font-semibold text-white">Built for fast technical review</h2>
          <p className="mt-3 text-sm text-slate-300">
            Keep packets concise while still detailed. Show only the requirements you can back and add one focused sample when it helps.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-slate-300">
            <li className="flex items-start gap-2">
              <CheckCircle className="mt-0.5 h-4 w-4 text-accent" /> Back each requirement with one or two concrete project links.
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="mt-0.5 h-4 w-4 text-accent" /> Add optional code, README, or commit samples only where they strengthen proof.
            </li>
          </ul>
          <p className="mt-3 text-xs uppercase tracking-[0.35em] text-slate-500">Built for reviewers who spend ~30 seconds before diving deeper.</p>
        </div>
      </section>

     

      <section className="border-t border-slate-800 bg-slate-900/40">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:px-6 md:grid-cols-2">
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

      <section className="mx-auto max-w-6xl rounded-3xl border border-slate-800/70 bg-slate-950/60 px-4 py-10 sm:px-6">
        <h2 className="text-xl font-semibold text-white">FAQ</h2>
        <div className="mt-4 space-y-4 text-sm text-slate-300">
          <div>
            <p className="font-semibold text-white">Is this a replacement for my resume?</p>
            <p className="mt-1 text-slate-300">
              No. Evidensify organizes requirement-linked proof so reviewers can verify your resume faster.
            </p>
          </div>
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
            <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-500 break-all">{citation.label}</div>
            <p className="text-xs text-slate-200 break-words">{citation.note}</p>
            <a href={citation.href} target="_blank" rel="noreferrer" className="text-accent">
              Open file
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function InlineSnippet({
  snippet,
}: {
  snippet: {
    summary: string;
    code: string;
    filePath?: string;
    lines?: string;
    language?: string;
  };
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-3 rounded-2xl border border-slate-800/80 bg-slate-950/50 p-3">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-2 text-left text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300"
        aria-expanded={open}
      >
        <span>View sample</span>
        <ChevronRight className={cn("h-3.5 w-3.5 transition-transform duration-200", open ? "rotate-90" : "")} aria-hidden="true" />
      </button>
      {open && (
        <div className="mt-3 space-y-2 text-xs text-slate-300">
          <p className="text-slate-100">{snippet.summary}</p>
          {(snippet.filePath || snippet.lines) && (
            <p className="font-mono text-[11px] text-slate-500">
              {snippet.filePath} {snippet.lines ? `· L${snippet.lines}` : ""}
            </p>
          )}
          <CodeSnippet code={snippet.code} language={snippet.language} className="max-w-full text-sm" />
        </div>
      )}
    </div>
  );
}
