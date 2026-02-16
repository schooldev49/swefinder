import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { PublicShareLayout } from "@/components/layout/public-share-layout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CodeSnippet } from "@/components/ui/code-snippet";
import { cn } from "@/lib/utils";
import { useSEO } from "@/lib/seo";

type ExampleCommitEntry = {
  sha: string;
  message: string;
  date: string;
  patch: string;
};

type ExampleSample = {
  id: string;
  type: "code" | "readme" | "commit";
  summary: string;
  projectFullName: string;
  filePath?: string;
  lineStart?: number;
  lineEnd?: number;
  language?: string;
  code?: string;
  tags?: string[];
  readmeHeading?: string;
  commitEntries?: ExampleCommitEntry[];
};

type ExampleProject = {
  id: string;
  fullName: string;
  sourceType: "github" | "link";
  description: string;
  whyItMatters?: string;
  context?: string;
  yearStart?: number;
  yearEnd?: number;
  yearPresent?: boolean;
  primaryLanguage?: string;
  aiUsage?: string;
  isFork?: boolean;
  htmlUrl?: string;
  demoUrl?: string;
  codeSamples: ExampleSample[];
};

const exampleProjects: ExampleProject[] = [
  {
    id: "p-1",
    fullName: "demo-student/ml-research-notebooks",
    sourceType: "github",
    description: "Evaluation and calibration workflows for model reliability.",
    whyItMatters: "Validated by internal benchmark runs and used for model release checks.",
    context: "Research",
    yearStart: 2025,
    yearEnd: 2026,
    primaryLanguage: "Python",
    aiUsage: "Assist. Wrote core eval logic manually and reviewed generated edits.",
    codeSamples: [
      {
        id: "s-1",
        type: "code",
        summary: "Typed evaluator with empty-dataset guard and failure export",
        projectFullName: "demo-student/ml-research-notebooks",
        filePath: "src/eval/metrics.py",
        lineStart: 42,
        lineEnd: 81,
        language: "python",
        code: `def evaluate_model(model: torch.nn.Module, loader: DataLoader) -> dict[str, float]:
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
        tags: ["evaluation", "guardrails"],
      },
      {
        id: "s-2",
        type: "readme",
        summary: "README section describing result quality and known limitations",
        projectFullName: "demo-student/ml-research-notebooks",
        filePath: "README.md",
        lineStart: 98,
        lineEnd: 126,
        language: "markdown",
        readmeHeading: "Results and limitations",
        code: `## Results and limitations

- Best run reached 0.94 F1 on the held-out toxicity split.
- False positives cluster around quoted speech and slang.
- Next iteration adds language-specific calibration and threshold checks.`,
      },
      {
        id: "s-3",
        type: "commit",
        summary: "Commit trail: eval hardening and regression test coverage",
        projectFullName: "demo-student/ml-research-notebooks",
        language: "diff",
        filePath: "Commits (3)",
        commitEntries: [
          {
            sha: "6f3kq2a",
            message: "feat(eval): add typed metrics logger and failure export",
            date: "Jan 12, 2026",
            patch: `@@ -31,6 +31,12 @@ def evaluate_model(...):
+ if results.total_examples == 0:
+     raise ValueError("empty evaluation set")
@@ -49,2 +55,3 @@ def evaluate_model(...):
- old_log_metrics(metrics)
+ log_metrics(metrics)
+ save_failure_cases(results.hard_negatives, "artifacts/failures.csv")`,
          },
          {
            sha: "9bc14de",
            message: "test(eval): add zero-example guard and regression test",
            date: "Jan 10, 2026",
            patch: `@@ -4,0 +5,5 @@
+ def test_empty_dataset_raises():
+     with pytest.raises(ValueError):
+         evaluate_model(model, empty_loader)`,
          },
        ],
      },
    ],
  },
  {
    id: "p-2",
    fullName: "demo-student/realtime-collab-board",
    sourceType: "github",
    description: "Realtime whiteboard sync with reconnect and conflict-safe updates.",
    whyItMatters: "Used by pilot users in weekly product demos.",
    context: "Startup",
    yearStart: 2026,
    yearPresent: true,
    primaryLanguage: "TypeScript",
    aiUsage: "No AI used.",
    codeSamples: [],
  },
];

export function ExamplePacketPage() {
  useSEO({
    title: "Example public proof profile",
    description: "Preview an example of an Evidensify public profile with collapsible code, README, and commit proof.",
    path: "/example-packet",
    type: "article",
  });

  const featured = exampleProjects.flatMap((project) => project.codeSamples);
  const code = featured.filter((sample) => sample.type === "code").slice(0, 3);
  const readme = featured.filter((sample) => sample.type === "readme").slice(0, 1);
  const commit = featured.filter((sample) => sample.type === "commit").slice(0, 3);

  return (
    <PublicShareLayout>
      <div className="space-y-8">
        <header className="rounded-3xl border border-slate-900/80 bg-slate-950/80 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 border border-slate-800">
                <AvatarImage src="https://avatars.githubusercontent.com/u/9919?v=4" alt="demo-student" />
                <AvatarFallback>DS</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm uppercase tracking-wide text-muted-foreground">Example profile</p>
                <h1 className="text-2xl font-semibold text-white">@demo-student</h1>
                <p className="text-sm text-muted-foreground">Static preview of the actual public profile layout.</p>
              </div>
            </div>
            <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 px-4 py-3 text-xs text-muted-foreground">
              Demo view only. Links are intentionally disabled.
            </div>
          </div>
        </header>

        <section className="space-y-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Featured projects</p>
            <p className="text-xs text-muted-foreground">Code, README, and commit evidence. Expand cards to inspect details.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <FeaturedGroup title="Code samples (max 3)" items={code} />
            <FeaturedGroup title="Commit samples (max 3)" items={commit} />
            <FeaturedGroup title="README sample (max 1)" items={readme} />
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Project index</p>
            <p className="text-xs text-muted-foreground">Public-source project context for quick recruiter scan.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {exampleProjects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </section>
      </div>
    </PublicShareLayout>
  );
}

function FeaturedGroup({ title, items }: { title: string; items: ExampleSample[] }) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{title}</p>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">None featured.</p>
      ) : (
        items.map((sample) => <FeaturedProofCard key={sample.id} sample={sample} />)
      )}
    </div>
  );
}

function FeaturedProofCard({ sample }: { sample: ExampleSample }) {
  const [open, setOpen] = useState(false);
  const [openCommitSha, setOpenCommitSha] = useState<string | null>(null);
  const isCode = sample.type === "code";

  return (
    <div className="rounded-xl border border-slate-900/80 bg-slate-950/70 p-3">
      <button type="button" className="flex w-full items-center justify-between gap-2 text-left" onClick={() => setOpen((prev) => !prev)}>
        <div>
          <p className="text-sm text-white">{sample.summary}</p>
          <p className="mt-1 text-[11px] text-slate-400">{sample.projectFullName}</p>
          <p className="text-[11px] text-slate-500">{formatLineLabel(sample.filePath, sample.lineStart, sample.lineEnd)}</p>
        </div>
        <ChevronRight className={cn("h-4 w-4 text-slate-500 transition-transform", open ? "rotate-90" : "")} />
      </button>
      {open ? (
        <div className="mt-3 space-y-2">
          {sample.tags && sample.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {sample.tags.map((tag) => (
                <Badge key={`${sample.id}-${tag}`} variant="outline" className="text-[10px]">
                  {tag}
                </Badge>
              ))}
            </div>
          ) : null}

          {sample.type === "commit" && sample.commitEntries && sample.commitEntries.length > 0 ? (
            <div className="rounded-lg border border-slate-900/70 bg-slate-900/40 p-2 text-[11px] text-slate-300">
              <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Commit trail</p>
              <div className="mt-1 space-y-2">
                {sample.commitEntries.map((entry) => {
                  const expanded = openCommitSha === entry.sha;
                  return (
                    <div key={entry.sha} className="rounded-md border border-slate-800/80 bg-slate-950/40 p-2">
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-2 text-left"
                        onClick={() => setOpenCommitSha((prev) => (prev === entry.sha ? null : entry.sha))}
                      >
                        <span className="truncate text-slate-200">{entry.message}</span>
                        <span className="font-mono text-[10px] text-slate-500">#{entry.sha.slice(0, 7)}</span>
                      </button>
                      {expanded ? (
                        <div className="mt-2">
                          <CodeSnippet code={limitDiffLines(entry.patch, 40)} language="diff" />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {isCode ? (
            <CodeSnippet code={sample.code || ""} language={sample.language || "tsx"} />
          ) : sample.type === "commit" ? (
            <p className="text-[11px] text-muted-foreground">Select a commit above to preview the diff.</p>
          ) : (
            <CodeSnippet code={sample.code || ""} language={sample.language || "markdown"} />
          )}

          <Button variant="outline" size="sm" disabled>
            Source link disabled in demo
          </Button>
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-muted-foreground">Collapsed for quick scan.</p>
      )}
    </div>
  );
}

function ProjectCard({ project }: { project: ExampleProject }) {
  const proofTypes = getProjectProofTypes(project);
  return (
    <Card className="rounded-2xl border border-slate-900/80 bg-slate-950/80">
      <CardContent className="space-y-2 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-base font-semibold text-white">{project.fullName}</p>
            <p className="text-sm text-muted-foreground">{project.description}</p>
          </div>
          <Badge variant={project.sourceType === "link" ? "outline" : "default"} className="text-[10px] uppercase tracking-wide">
            {project.sourceType === "link" ? "External" : "GitHub"}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-1">
          {proofTypes.map((type) => (
            <Badge key={`${project.id}-${type}`} variant="outline" className="text-[10px] uppercase tracking-wide">
              {type}
            </Badge>
          ))}
          {project.isFork ? (
            <Badge variant="warning" className="text-[10px] uppercase tracking-wide">
              Fork
            </Badge>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {project.context ? <span>{project.context}</span> : null}
          {formatProjectYearRange(project) ? <span>{formatProjectYearRange(project)}</span> : null}
          {project.primaryLanguage ? <span>{project.primaryLanguage}</span> : null}
        </div>
        {project.whyItMatters ? <p className="text-[11px] text-slate-300">Why it matters: {project.whyItMatters}</p> : null}
        {project.aiUsage ? <p className="text-[11px] text-slate-400">{project.aiUsage}</p> : null}
        <Button variant="outline" size="sm" disabled>
          Source link disabled in demo
        </Button>
      </CardContent>
    </Card>
  );
}

function formatLineLabel(filePath?: string, start?: number, end?: number): string {
  const path = filePath || "snippet";
  if (start && end) return `${path} #L${start}-${end}`;
  if (start) return `${path} #L${start}`;
  return path;
}

function formatProjectYearRange(project: Pick<ExampleProject, "yearStart" | "yearEnd" | "yearPresent">): string {
  const currentYear = new Date().getFullYear();
  if (!project.yearStart) return "";
  if (project.yearPresent) {
    return project.yearStart === currentYear ? String(currentYear) : `${project.yearStart} - Present`;
  }
  if (project.yearEnd && project.yearEnd !== project.yearStart) {
    return `${project.yearStart} - ${project.yearEnd}`;
  }
  return String(project.yearStart);
}

function limitDiffLines(diff: string, maxLines: number): string {
  const lines = diff.split("\n");
  if (lines.length <= maxLines) return diff;
  return `${lines.slice(0, maxLines).join("\n")}\n...`;
}

function getProjectProofTypes(project: Pick<ExampleProject, "sourceType" | "fullName" | "demoUrl">): string[] {
  const labels = new Set<string>();
  const source = project.fullName.toLowerCase();
  const demo = (project.demoUrl || "").toLowerCase();
  if (project.sourceType === "github") labels.add("Repo");
  if (source.includes("/pull/")) labels.add("PR");
  if (source.includes("/commit/")) labels.add("Commit");
  if (source.includes("readme")) labels.add("Writeup");
  if (demo.includes("youtube.com") || demo.includes("vercel.app")) labels.add("Demo");
  if (labels.size === 0) labels.add("Case study");
  return Array.from(labels);
}
