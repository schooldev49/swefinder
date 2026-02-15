import { useState } from "react";
import { PublicShareLayout } from "@/components/layout/public-share-layout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CodeSnippet } from "@/components/ui/code-snippet";
import { useSEO } from "@/lib/seo";

const exampleRequirements = [
  {
    id: "req-1",
    text: "Design ML experiments and report clear evaluation outcomes",
    priority: 1,
    evidence: "demo-student/ml-research-notebooks",
    rationale: "Built an evaluation helper that enforces dataset checks and logs reproducible metrics.",
    source: "src/eval/metrics.py#L42-L86",
    aiUsage: "Assist (Copilot). Reviewed outputs and wrote evaluation logic manually.",
  },
  {
    id: "req-2",
    text: "Ship production-ready real-time product features",
    priority: 2,
    evidence: "demo-student/realtime-collab-board",
    rationale: "Implemented connection-aware room sync for realtime collaboration behavior.",
    source: "src/hooks/useRoom.ts#L12-L37",
    aiUsage: "No AI used.",
  },
  {
    id: "req-3",
    text: "Communicate technical results to mixed audiences",
    priority: 3,
    evidence: "demo-student/ml-research-notebooks",
    rationale: "Added concise experiment readouts and limitation notes in README results sections.",
    source: "README.md#L98-L126",
    aiUsage: "Assist (Cursor). Rewrote wording only and kept facts unchanged.",
  },
];

const exampleSnippet = `def evaluate_model(model: torch.nn.Module, loader: DataLoader) -> dict[str, float]:
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
    return metrics`;

const exampleReadmeExcerpt = `## Results and limitations

- Best run reached 0.94 F1 on the held-out toxicity split.
- False positives cluster around quoted speech and slang.
- Next iteration will add language-specific calibration.
`;

const exampleCommitTrail = [
  {
    sha: "6f3kq2a",
    message: "feat(eval): add typed metrics logger and failure export",
    date: "Jan 12, 2026",
    files: "src/eval/metrics.py, src/eval/io.py",
    url: "https://github.com/demo-student/ml-research-notebooks/commit/6f3kq2a",
    diff: `+ if results.total_examples == 0:
    raise ValueError("empty evaluation set")

- old_log_metrics(metrics)
log_metrics(metrics)
save_failure_cases(results.hard_negatives, "artifacts/failures.csv")`,
  },
  {
    sha: "9bc14de",
    message: "test(eval): add zero-example guard and regression test",
    date: "Jan 10, 2026",
    files: "tests/test_metrics.py",
    url: "https://github.com/demo-student/ml-research-notebooks/commit/9bc14de",
    diff: `+ def test_empty_dataset_raises():
    with pytest.raises(ValueError):
        evaluate_model(model, empty_loader)`,
  },
  {
    sha: "a41e8c1",
    message: "refactor(sync): isolate room provider lifecycle hook",
    date: "Jan 8, 2026",
    files: "src/hooks/useRoom.ts",
    url: "https://github.com/demo-student/realtime-collab-board/commit/a41e8c1",
    diff: `+ export function useRoomLifecycle(roomId: string) {
    // moved setup logic out of useEffect
    // setup, reconnect handling, cleanup
}`,
  },
];

export function ExamplePacketPage() {
  useSEO({
    title: "Example job-specific packet",
    description: "Preview an example packet with mapped requirements, code samples, README evidence, and commit trail.",
    path: "/example-packet",
    type: "article",
  });
  const [showSample, setShowSample] = useState(false);
  const [openCommit, setOpenCommit] = useState<string | null>(null);

  return (
    <PublicShareLayout>
      <div className="space-y-6">
        <Card className="border-slate-900/80 bg-slate-950/80">
          <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14 border border-slate-800">
                <AvatarImage src="https://avatars.githubusercontent.com/u/9919?v=4" alt="demo-student" />
                <AvatarFallback>DS</AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-white">Proof Packet - ML Research Intern @ Nova Robotics</CardTitle>
                <CardDescription>@demo-student {"->"} ML Research Intern @ Nova Robotics</CardDescription>
                <p className="mt-1 text-xs text-primary">Unlisted packet link: /p/6F3kQ2</p>
              </div>
            </div>
            <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 px-4 py-3 text-xs text-muted-foreground">
              Every claim links to a repo path, README section, or sample.
              <p className="mt-1 text-slate-400">Evidence snapshot: Jan 12, 2026</p>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="rounded-xl border border-slate-900/80 bg-slate-950/60 px-3 py-2 text-sm text-slate-200">
              Requirement-first packet with direct evidence mapping for fast technical review.
            </p>
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              <Button variant="outline" size="sm" asChild>
                <a href="#example-requirements">Requirements</a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href="#example-citations">Citations</a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href="#example-samples">Samples</a>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-900/80 bg-slate-950/80">
          <CardHeader>
            <CardTitle className="text-white">Proof Packet contents</CardTitle>
            <CardDescription>Skim requirements first, then open links to verify.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <section id="example-requirements">
              <SectionHeading title="Key requirements" subtitle="Each mapped to concrete evidence." />
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {exampleRequirements.map((requirement) => (
                  <div key={requirement.id} className="space-y-3 rounded-2xl border border-slate-900/80 bg-slate-950/60 p-4">
                    <div>
                      <p className="text-sm font-semibold text-white">{requirement.text}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                          Priority {requirement.priority}
                        </Badge>
                        <span>Evidence: 1</span>
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-900/80 p-3 text-xs text-muted-foreground">
                      <p className="font-semibold text-white">{requirement.evidence}</p>
                      <p className="mt-1">{requirement.rationale}</p>
                      <p className="mt-1 text-[11px] text-slate-500">AI usage: {requirement.aiUsage}</p>
                      <p className="text-[11px] text-slate-400">Updated Jan 12, 2026</p>
                      <p className="font-mono text-[10px] text-slate-500">Snapshot #6f3kq2a</p>
                      <p className="mt-1 break-all text-[10px] uppercase tracking-[0.25em] text-slate-500">{requirement.source}</p>
                      <a href="#example-citations" className="text-primary underline">
                        View proof
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section id="example-samples">
              <SectionHeading title="Evidence samples" subtitle="Optional deep dive for technical interviewers." />
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border border-slate-900/80 bg-slate-950/60 p-4 text-xs text-muted-foreground">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-white">Evaluation helper with guardrails</p>
                        <Badge variant="outline" className="border-accent/60 text-[10px] uppercase tracking-wide text-accent">
                          Code sample
                        </Badge>
                      </div>
                      <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500">src/eval/metrics.py lines 42-86</p>
                      <p className="text-[11px] text-slate-400">Updated Jan 12, 2026</p>
                      <p className="font-mono text-[10px] text-slate-500">Snapshot #6f3kq2a</p>
                    </div>
                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => setShowSample((prev) => !prev)}>
                      {showSample ? "Hide sample" : "Preview sample"}
                    </Button>
                  </div>
                  {showSample ? (
                    <div className="mt-3">
                      <CodeSnippet code={exampleSnippet} language="python" />
                    </div>
                  ) : (
                    <p className="mt-3 text-[11px] text-muted-foreground">Collapsed until reviewer opens it.</p>
                  )}
                </div>
                <div className="rounded-2xl border border-slate-900/80 bg-slate-950/60 p-4 text-xs text-muted-foreground">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-white">README results excerpt</p>
                    <Badge variant="outline" className="border-accent/60 text-[10px] uppercase tracking-wide text-accent">
                      README sample
                    </Badge>
                  </div>
                  <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500">README.md lines 98-126</p>
                  <p className="text-[11px] text-slate-400">Updated Jan 12, 2026</p>
                  <p className="font-mono text-[10px] text-slate-500">Snapshot #6f3kq2a</p>
                  <div className="mt-3 rounded-xl border border-slate-900/70 bg-slate-900/60 p-3 whitespace-pre-wrap text-sm text-slate-200">
                    {exampleReadmeExcerpt}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-900/80 bg-slate-950/60 p-4 text-xs text-muted-foreground">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-white">Commit trail summary</p>
                    <Badge variant="outline" className="border-accent/60 text-[10px] uppercase tracking-wide text-accent">
                      Commit sample
                    </Badge>
                  </div>
                  <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Main branch commit trail, last 3 relevant commits</p>
                  <p className="text-[11px] text-slate-400">Updated Jan 12, 2026</p>
                  <p className="font-mono text-[10px] text-slate-500">Snapshot #6f3kq2a</p>
                  <div className="mt-3 space-y-2">
                    {exampleCommitTrail.map((entry) => (
                      <div key={entry.sha} className="rounded-xl border border-slate-900/70 bg-slate-900/50 p-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-sm text-slate-100">{entry.message}</p>
                            <p className="mt-1 text-[11px] text-slate-400">{entry.files}</p>
                            <div className="mt-1 flex items-center gap-2 text-[11px]">
                              <span className="text-slate-500">{entry.date}</span>
                              <a href={entry.url} target="_blank" rel="noopener noreferrer nofollow" className="font-mono text-primary underline">
                                #{entry.sha}
                              </a>
                            </div>
                          </div>
                          <Button variant="ghost" size="sm" className="text-xs" onClick={() => setOpenCommit((prev) => (prev === entry.sha ? null : entry.sha))}>
                            {openCommit === entry.sha ? "Hide commit" : "View commit"}
                          </Button>
                        </div>
                        {openCommit === entry.sha ? (
                          <div className="mt-2">
                            <CodeSnippet code={entry.diff} language="diff" />
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

          

           

            <section id="example-citations">
              <SectionHeading title="Evidence citations" subtitle="Open links to verify code and docs." />
              <div className="mt-3 space-y-3">
                {exampleRequirements.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-900/80 bg-slate-950/60 p-4 text-xs text-muted-foreground">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{item.evidence}</p>
                    <p className="text-sm text-white">{item.rationale}</p>
                    <p className="text-[11px] text-slate-400">Updated Jan 12, 2026</p>
                    <p className="font-mono text-[10px] text-slate-500">Snapshot #6f3kq2a</p>
                    <p className="mt-1 break-all text-[10px] uppercase tracking-[0.25em] text-slate-500">{item.source}</p>
                  </div>
                ))}
              </div>
            </section>
          </CardContent>
        </Card>
      </div>
    </PublicShareLayout>
  );
}

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h2 className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-400">{title}</h2>
      {subtitle ? <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p> : null}
    </div>
  );
}
