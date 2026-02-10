import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ChevronRight } from "lucide-react";
import type { CommitEntry, Evidence, EvidenceMappingWithEvidence, ProofPacketCodeSample } from "@evidensify/types";
import { fetchSharedPacket } from "@/lib/api";
import { PublicShareLayout } from "@/components/layout/public-share-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CodeSnippet } from "@/components/ui/code-snippet";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";


const trustPoints = [
  "Requirements mapped to specific repo paths or demos.",
  "User-provided metrics stay labeled and auditable.",
  "Links open directly to GitHub or docs the candidate already shared—no hoops.",
  "Every packet is manually curated before sending.",
];

const SAMPLE_TYPE_LABELS: Record<string, string> = {
  code: "Code sample",
  readme: "README sample",
  commit: "Commit sample",
};

export function PublicPacketPage() {
  const { handle, packetSlug } = useParams();
  const packetQuery = useQuery({
    queryKey: ["public-packet", handle, packetSlug],
    queryFn: () => fetchSharedPacket(handle ?? "", packetSlug ?? ""),
    enabled: Boolean(handle && packetSlug),
  });

  return (
    <PublicShareLayout>
      <div className="mb-6 rounded-2xl border border-slate-900/80 bg-slate-950/60 p-4 text-sm text-slate-200">
        <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">Attach with resume</p>
        <p className="mt-2">
          This Proof Packet is an add-on to the candidate's chronological resume. It aligns their repositories and artifacts to this specific job so you can verify work quickly.
        </p>
      </div>
      {packetQuery.isLoading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-slate-900/60" />
      ) : packetQuery.isError ? (
        <PacketError />
      ) : packetQuery.data ? (
        <PacketView data={packetQuery.data} />
      ) : null}
    </PublicShareLayout>
  );
}

function PacketView({
  data,
}: {
  data: Awaited<ReturnType<typeof fetchSharedPacket>>;
}) {
  const proof = data.proofPacket;
  const citations = useMemo(() => buildCitationList(proof?.mappings ?? []), [proof?.mappings]);
  const requirementSampleMap = proof?.requirementSampleMap || {};
  const proofSamples = proof?.codeSamples ?? [];

  return (
    <div className="space-y-6">
      
      <Card className="border-slate-900/80 bg-slate-950/80">
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14 border border-slate-800">
              <AvatarImage src={data.user.githubAvatarUrl} alt={data.user.githubLogin} />
              <AvatarFallback>{data.user.githubLogin.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-white">{proof?.title ?? `Proof Packet – ${data.job.title}`}</CardTitle>
              <CardDescription>
                @{data.user.profileSlug} → {data.job.title}
                {data.job.company ? ` @ ${data.job.company}` : ""}
              </CardDescription>
              {data.job.jobUrl && (
                <a href={data.job.jobUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">
                  View original JD
                </a>
              )}
            </div>
          </div>
          <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 px-4 py-3 text-xs text-muted-foreground">
            Every bullet and requirement links to verifiable repos or docs supplied by the candidate.
          </div>
        </CardHeader>
      </Card>

      {proof ? (
        <Card className="border-slate-900/80 bg-slate-950/80">
          <CardHeader>
            <CardTitle className="text-white">Proof Packet contents</CardTitle>
            <CardDescription>
              Curated by the candidate for this specific role—every line links to code or docs you can spot-check in under a minute.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <section>
              <SectionHeading title="Key requirements" subtitle="Each mapped to concrete repos or docs." />
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {proof.requirements.slice(0, 5).map((requirement) => (
                  <RequirementPublicCard
                    key={requirement.id}
                    requirement={requirement}
                    mappings={proof.mappings.filter((mapping) => mapping.requirementId === requirement.id)}
                    sampleOptions={proofSamples}
                    selectedSampleId={requirementSampleMap[requirement.id] ?? null}
                  />
                ))}
              </div>
            </section>
            {proof.codeSamples && proof.codeSamples.length > 0 && (
              <PublicCodeSamples samples={proof.codeSamples} />
            )}
            <section>
              <SectionHeading title="JD-specific bullets" />
              <ul className="mt-4 space-y-3">
                {proof.bullets.map((bullet, index) => (
                  <li key={index} className="rounded-2xl border border-slate-900/80 bg-slate-950/60 p-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" aria-hidden="true" />
                      <p className="text-sm text-white">{bullet}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <SectionHeading title="Outreach note" />
              <div className="rounded-2xl border border-slate-900/80 bg-slate-950/60 p-4 text-sm text-white">
                {proof.outreachNote}
              </div>
            </section>
            <section>
              <SectionHeading title="Evidence citations" subtitle="Click through to verify code, notebooks, or demos." />
              {citations.length === 0 ? (
                <p className="text-xs text-muted-foreground">No citations available.</p>
              ) : (
                <div className="mt-3 space-y-3">
                  {citations.map((evidence) => (
                    <div key={evidence.id} className="rounded-2xl border border-slate-900/80 bg-slate-950/60 p-4 text-xs text-muted-foreground">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{evidence.projectFullName}</p>
                      {evidence.description && <p className="text-sm text-white">{evidence.description}</p>}
                      {evidence.fileUrl && (
                        <a href={evidence.fileUrl} target="_blank" rel="noopener noreferrer nofollow" className="text-primary underline">
                          View source
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-slate-900/80 bg-slate-950/80">
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Proof Packet not available yet. Ask the candidate to regenerate and resend the link.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="rounded-2xl border border-slate-900/80 bg-slate-950/60 p-4 text-sm text-slate-200">
        <h3 className="text-xs uppercase tracking-[0.35em] text-muted-foreground">How to read this</h3>
        <ul className="mt-3 space-y-2 text-sm text-slate-300">
          <li>• Use this alongside the candidate's chronological resume—it's just an evidence sheet.</li>
          <li>• Links open GitHub or other hosts you already trust. Code is collapsed unless you open it.</li>
          <li>• Nothing is auto-scored; every claim is tied to a concrete repo, doc, or demo.</li>
        </ul>
        <Link to="/security" className="mt-3 inline-block text-xs text-primary underline">
          Security & access practices
        </Link>
      </div>

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
    </div>
  );
}

function RequirementPublicCard({
  requirement,
  mappings,
  sampleOptions,
  selectedSampleId,
}: {
  requirement: NonNullable<Awaited<ReturnType<typeof fetchSharedPacket>>["proofPacket"]>["requirements"][number];
  mappings: EvidenceMappingWithEvidence[];
  sampleOptions: ProofPacketCodeSample[];
  selectedSampleId: string | null;
}) {
  const selectedSample = sampleOptions.find((sample) => sample.id === selectedSampleId);
  const trimmedMappings = mappings.slice(0, 2);
  const [openSample, setOpenSample] = useState(false);

  useEffect(() => {
    if (!selectedSample) {
      setOpenSample(false);
    }
  }, [selectedSample]);

  return (
    <div className="rounded-2xl border border-slate-900/80 bg-slate-950/60 p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-white">{requirement.text}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
            Priority {requirement.priority}
          </Badge>
          <span>Evidence: {mappings.length || "0"}</span>
        </div>
      </div>
      <div className="space-y-2">
        {trimmedMappings.length === 0 ? (
          <p className="text-xs text-muted-foreground">No direct evidence yet.</p>
        ) : (
          trimmedMappings.map((mapping) => (
            <div key={mapping.id} className="rounded-xl border border-slate-900/80 p-3 text-xs text-muted-foreground">
              <p className="font-semibold text-white">{mapping.evidence.projectFullName}</p>
              {mapping.rationale && <p>{mapping.rationale}</p>}
              {mapping.evidence.fileUrl && (
                <a
                  href={mapping.evidence.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="text-primary underline"
                >
                  View proof
                </a>
              )}
              {formatAiUsagePublic(mapping.evidence) && (
                <p className="text-[11px] text-slate-500 mt-1">{formatAiUsagePublic(mapping.evidence)}</p>
              )}
              {mapping.evidence.codeSnippet ? <EvidenceSnippetBlock snippet={mapping.evidence.codeSnippet} /> : null}
            </div>
          ))
        )}
      </div>
      {selectedSample && (
        <div className="space-y-2 rounded-xl border border-slate-900/80 bg-slate-950/70 p-3 text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">{getPublicSampleLabel(selectedSample)}</p>
              <p className="text-sm font-semibold text-white">{selectedSample.summary}</p>
              <p>{formatPublicLineLabel(selectedSample.filePath, selectedSample.lineStart, selectedSample.lineEnd)}</p>
              <SampleHighlightMetaPublic sample={selectedSample} />
              {selectedSample.tags && selectedSample.tags.length > 0 ? (
                <div className="mt-1 flex flex-wrap gap-1">
                  {selectedSample.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-[10px]">
                      {tag}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>
            <Button variant="secondary" size="sm" onClick={() => setOpenSample((prev) => !prev)}>
              {openSample ? "Hide sample" : "View sample"}
            </Button>
          </div>
          {openSample ? (
            selectedSample.type && selectedSample.type !== "code" ? (
              <>
                <div className="rounded-lg border border-slate-900/80 bg-slate-900/60 p-3 text-sm text-slate-200 whitespace-pre-wrap">
                  {selectedSample.code}
                </div>
                {selectedSample.url && (
                  <a href={selectedSample.url} target="_blank" rel="noopener noreferrer nofollow" className="text-primary underline">
                    View on GitHub
                  </a>
                )}
              </>
            ) : (
              <>
                <CodeSnippet code={selectedSample.code} language={selectedSample.language || inferLanguage(selectedSample.filePath) || "tsx"} />
                {selectedSample.url && (
                  <a href={selectedSample.url} target="_blank" rel="noopener noreferrer nofollow" className="text-primary underline">
                    View on GitHub
                  </a>
                )}
              </>
            )
          ) : (
            <p className="text-[11px] text-muted-foreground">Collapsed until a reviewer chooses to dive in.</p>
          )}
        </div>
      )}
    </div>
  );
}

function PublicCodeSamples({ samples }: { samples: ProofPacketCodeSample[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <section>
      <SectionHeading title="Evidence samples" subtitle="Optional deep dives for engineers—code, docs, or commits." />
      <div className="mt-4 space-y-3">
        {samples.map((sample) => {
          const open = expanded.has(sample.id);
          return (
            <div key={sample.id} className="rounded-2xl border border-slate-900/80 bg-slate-950/60 p-4 text-xs text-muted-foreground">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-white">{sample.summary}</p>
                    <Badge variant="outline" className="border-accent/60 text-[10px] uppercase tracking-wide text-accent">
                      {getPublicSampleLabel(sample)}
                    </Badge>
                  </div>
                  <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">
                    {sample.projectFullName} {formatPublicLineLabel(sample.filePath, sample.lineStart, sample.lineEnd)}
                  </p>
                  <SampleHighlightMetaPublic sample={sample} />
                  {sample.tags && sample.tags.length > 0 ? (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {sample.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-[10px]">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  {sample.url && (
                    <a href={sample.url} target="_blank" rel="noopener noreferrer nofollow" className="text-[11px] text-primary underline">
                      View on GitHub
                    </a>
                  )}
                  <Button variant="ghost" size="sm" className="text-xs" onClick={() => toggle(sample.id)}>
                    {open ? "Hide sample" : "Preview sample"}
                  </Button>
                </div>
              </div>
              {open && (
                <div className="mt-3">
                  {sample.type && sample.type !== "code" ? (
                    <div className="rounded-xl border border-slate-900/70 bg-slate-900/60 p-3 text-sm text-slate-200 whitespace-pre-wrap">
                      {sample.code}
                    </div>
                  ) : (
                    <CodeSnippet code={sample.code} language={sample.language || inferLanguage(sample.filePath) || "tsx"} />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function formatPublicLineLabel(filePath?: string, start?: number, end?: number) {
  const path = filePath || "snippet";
  if (start && end) return `${path} #L${start}-${end}`;
  if (start) return `${path} #L${start}`;
  return path;
}

function SampleHighlightMetaPublic({ sample }: { sample?: { type?: string; readmeHeading?: string; commitEntries?: CommitEntry[] } }) {
  if (!sample) return null;
  const showHeading = sample.type === "readme" && sample.readmeHeading;
  const entries = sample.type === "commit" ? sample.commitEntries ?? [] : [];
  if (!showHeading && entries.length === 0) return null;
  return (
    <div className="mt-1 space-y-2">
      {showHeading ? <p className="text-[11px] text-slate-400">README section: {sample.readmeHeading}</p> : null}
      {entries.length > 0 ? <PublicCommitTrail entries={entries} /> : null}
    </div>
  );
}

function PublicCommitTrail({ entries }: { entries: CommitEntry[] }) {
  if (!entries.length) return null;
  return (
    <div className="mt-2 rounded-lg border border-slate-900/70 bg-slate-900/40 p-2 text-[11px] text-slate-300">
      <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Commit trail · {entries.length} entr{entries.length === 1 ? "y" : "ies"}</p>
      <ul className="mt-1 space-y-1">
        {entries.map((entry) => {
          const label = truncateTextPublic(entry.message?.split("\n")[0] || entry.sha, 90);
          const shortSha = entry.sha ? entry.sha.slice(0, 7) : "commit";
          return (
            <li key={entry.sha} className="flex items-center gap-2">
              <span className="flex-1 truncate">{label}</span>
              {entry.htmlUrl ? (
                <a href={entry.htmlUrl} target="_blank" rel="noopener noreferrer nofollow" className="font-mono text-[10px] text-primary underline">
                  #{shortSha}
                </a>
              ) : (
                <span className="font-mono text-[10px] text-slate-500">#{shortSha}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function truncateTextPublic(value: string, max = 80) {
  if (!value) return "";
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

function getPublicSampleLabel(sample?: { type?: string }) {
  return SAMPLE_TYPE_LABELS[sample?.type || "code"] || "Code sample";
}

function inferLanguage(filePath?: string) {
  if (!filePath) return "";
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".py")) return "python";
  if (lower.endsWith(".ts") || lower.endsWith(".tsx")) return "tsx";
  if (lower.endsWith(".js") || lower.endsWith(".jsx")) return "javascript";
  if (lower.endsWith(".rs")) return "rust";
  if (lower.endsWith(".go")) return "go";
  if (lower.endsWith(".java")) return "java";
  if (lower.endsWith(".sql")) return "sql";
  return "";
}

function buildCitationList(mappings: EvidenceMappingWithEvidence[]): Evidence[] {
  const seen = new Map<string, Evidence>();
  mappings.forEach((mapping) => {
    const key = mapping.evidence.fileUrl || mapping.evidence.repoPath || `${mapping.evidence.projectFullName}-${mapping.evidence.title}`;
    if (key && !seen.has(key)) {
      seen.set(key, mapping.evidence);
    }
  });
  return Array.from(seen.values());
}

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

const AI_ROLE_LABELS: Record<string, string> = {
  none: "No AI",
  assist: "Assist",
  "co-design": "Co-design",
  "agent-orchestration": "Agent orchestration",
};

function formatAiUsagePublic(evidence: { aiRole?: string; aiTools?: string[]; aiSupervisionNotes?: string }): string | null {
  const parts: string[] = [];
  if (evidence.aiRole && AI_ROLE_LABELS[evidence.aiRole]) {
    parts.push(`AI role: ${AI_ROLE_LABELS[evidence.aiRole]}`);
  }
  if (evidence.aiTools && evidence.aiTools.length) {
    parts.push(`Tools: ${evidence.aiTools.join(", ")}`);
  }
  if (evidence.aiSupervisionNotes) {
    parts.push(`Supervision: ${evidence.aiSupervisionNotes}`);
  }
  if (!parts.length) return null;
  return parts.join(" · ");
}

function EvidenceSnippetBlock({
  snippet,
}: {
  snippet: NonNullable<Awaited<ReturnType<typeof fetchSharedPacket>>["proofPacket"]>["mappings"][number]["evidence"]["codeSnippet"];
}) {
  const [open, setOpen] = useState(false);
  if (!snippet) return null;
  const isCodeSample = !snippet.type || snippet.type === "code";

  return (
    <div className="mt-2 rounded-xl border border-slate-900/80 bg-slate-950/30 p-3 text-[11px] text-slate-300">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 text-left font-semibold uppercase tracking-[0.3em] text-slate-400"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        <span>View sample</span>
        <ChevronRight className={cn("h-3.5 w-3.5 transition-transform duration-200", open ? "rotate-90" : "")} aria-hidden="true" />
      </button>
      {open && (
        <div className="mt-3 space-y-2 text-xs text-slate-300">
          <p className="text-slate-100">{snippet.summary}</p>
          <p className="font-mono text-[11px] text-slate-500">
            {snippet.filePath}
            {snippet.lineStart && snippet.lineEnd ? ` · L${snippet.lineStart}–${snippet.lineEnd}` : ""}
          </p>
          {isCodeSample ? (
            <CodeSnippet code={snippet.code} language={snippet.language} className="max-w-full text-sm" />
          ) : (
            <div className="rounded-xl border border-slate-900/60 bg-slate-900/50 p-3 text-slate-200 whitespace-pre-wrap">{snippet.code}</div>
          )}
          {snippet.url && (
            <a href={snippet.url} target="_blank" rel="noopener noreferrer nofollow" className="text-primary underline">
              Open on GitHub
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function PacketError() {
  return (
    <div className="rounded-2xl border border-slate-900/80 bg-slate-950/80 p-10 text-center text-sm text-muted-foreground">
      Proof Packet not found. Double-check the link with the candidate.
    </div>
  );
}
