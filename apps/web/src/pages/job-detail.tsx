/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  EvidenceMappingWithEvidence,
  Job,
  Project,
  ProofPacketCodeSample,
  ProjectCodeSample,
  Requirement,
} from "@evidensify/types";
import { fetchJob, fetchProjects, generateProof, updateJobStatus } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/hooks/use-session";
import { CodeSnippet } from "@/components/ui/code-snippet";

const STATUS_ORDER: Job["status"][] = ["DRAFT", "PROOF_GENERATED", "APPLIED", "INTERVIEW", "REJECTED", "OFFER"];

export function JobDetailPage() {
  const { id } = useParams();
  const jobId = id ?? "";
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const jobQuery = useQuery({ queryKey: ["job", jobId], queryFn: () => fetchJob(jobId), enabled: Boolean(jobId) });
  const projectsQuery = useQuery({ queryKey: ["projects"], queryFn: fetchProjects });
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [bulletDrafts, setBulletDrafts] = useState<string[]>([]);
  const [outreachDraft, setOutreachDraft] = useState("");
  const [requirementNotes, setRequirementNotes] = useState<Record<string, string>>({});
  const [selectedSamples, setSelectedSamples] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (projectsQuery.data) {
      setSelectedProjects(new Set(projectsQuery.data.map((project) => project.id)));
    }
  }, [projectsQuery.data]);

  const job = jobQuery.data?.job;
  const proof = jobQuery.data?.proofPacket;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const shareLink =
    session?.profileSlug && job?.shareSlug ? `${origin}/users/${session.profileSlug}/${job.shareSlug}` : "";

  const citations = useMemo(() => {
    if (!proof) return [];
    const unique = new Map<string, EvidenceMappingWithEvidence["evidence"]>();
    proof.mappings.forEach((mapping) => {
      const sourceKey =
        mapping.evidence.fileUrl ||
        mapping.evidence.repoPath ||
        `${mapping.evidence.projectFullName}-${mapping.evidence.title ?? ""}`;
      if (!sourceKey) return;
      if (!unique.has(sourceKey)) {
        unique.set(sourceKey, mapping.evidence);
      }
    });
    return Array.from(unique.values());
  }, [proof]);

  const filteredCitations = useMemo(() => {
    return citations.filter((evidence) => {
      if (!evidence.projectId) return true;
      return selectedProjects.has(evidence.projectId);
    });
  }, [citations, selectedProjects]);

  const availableSamples = useMemo(() => {
    if (!projectsQuery.data) return [];
    const selectedIds = new Set(selectedProjects);
    return projectsQuery.data
      .filter((project) => selectedIds.has(project.id))
      .flatMap((project) =>
        (project.codeSamples ?? []).map((sample) => ({
          ...sample,
          projectId: project.id,
          projectFullName: project.fullName,
        }))
      );
  }, [projectsQuery.data, selectedProjects]);

  useEffect(() => {
    if (!proof) {
      setBulletDrafts([]);
      setOutreachDraft("");
      setRequirementNotes({});
      setSelectedSamples(new Set());
      return;
    }
    setBulletDrafts(proof.bullets);
    setOutreachDraft(proof.outreachNote);
    const mappedNotes: Record<string, string> = {};
    proof.requirements.forEach((requirement) => {
      mappedNotes[requirement.id] = requirement.notes || "";
    });
    setRequirementNotes(mappedNotes);
    setSelectedSamples(new Set(proof.codeSamples?.map((sample) => sample.id) ?? []));
  }, [proof]);

  useEffect(() => {
    setSelectedSamples((prev) => {
      const allowed = new Set(availableSamples.map((sample) => sample.id));
      let changed = false;
      const next = new Set<string>();
      prev.forEach((id) => {
        if (allowed.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      });
      if (!changed && next.size === prev.size) {
        return prev;
      }
      return next;
    });
  }, [availableSamples]);

  const statusMutation = useMutation({
    mutationFn: (status: Job["status"]) => updateJobStatus(jobId, status),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["job", jobId] });
      await queryClient.invalidateQueries({ queryKey: ["jobs"] });
      toast("Status updated");
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: () =>
      generateProof(jobId, {
        selectedProjectIds: Array.from(selectedProjects),
        selectedSampleIds: Array.from(selectedSamples),
      }),
    onSuccess: async (packet) => {
      toast("Proof refreshed", { description: packet.title });
      await queryClient.invalidateQueries({ queryKey: ["job", jobId] });
    },
    onError: (error: Error) => toast("Could not regenerate", { description: error.message }),
  });

  const handleSampleToggle = (sampleId: string, checked: boolean) => {
    setSelectedSamples((prev) => {
      const next = new Set(prev);
      if (checked) {
        if (next.size >= 3) {
          toast("Limit reached", { description: "Attach up to 3 code samples per packet." });
          return prev;
        }
        next.add(sampleId);
      } else {
        next.delete(sampleId);
      }
      return next;
    });
  };

  if (jobQuery.isLoading) {
    return <div className="h-32 animate-pulse rounded-xl bg-slate-900/60" />;
  }

  if (!job) {
    return (
      <div className="rounded-xl border border-slate-800/80 p-10 text-center text-muted-foreground">
        Job not found.
      </div>
    );
  }

  const nextStatus = getNextStatus(job.status);
  const statusMeta = getStatusMeta(job.status);
  const lastUpdated = job.proofPacketId ? proof?.createdAt || job.createdAt : job.createdAt;

  return (
    <div className="grid gap-6">
      <Card className="border-slate-800/80 bg-slate-950/40">
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-white">{job.title}</CardTitle>
            <CardDescription>{job.company}</CardDescription>
            {job.jobUrl && (
              <a href={job.jobUrl} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
                View posting
              </a>
            )}
            {lastUpdated && <p className="text-xs text-muted-foreground">Last updated {new Date(lastUpdated).toLocaleDateString()}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
            {nextStatus && (
              <Button size="sm" variant="secondary" onClick={() => statusMutation.mutate(nextStatus)} disabled={statusMutation.isPending}>
                Mark as {nextStatus.toLowerCase()}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground whitespace-pre-line">{job.rawDescription}</p>
        </CardContent>
      </Card>

      <Card className="border-slate-800/80 bg-slate-950/40">
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-white">Proof Packet</CardTitle>
            <CardDescription>
              Evidence-first summary you curate before sharing—so startups know you reviewed every proof point yourself.
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              onClick={() => regenerateMutation.mutate()}
              disabled={regenerateMutation.isPending || selectedProjects.size === 0}
            >
              {regenerateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Regenerate
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {projectsQuery.data && projectsQuery.data.length > 0 && (
            <ProjectSelector
              projects={projectsQuery.data}
              selected={selectedProjects}
              onChange={setSelectedProjects}
            />
          )}
          {availableSamples.length > 0 && (
            <CodeSamplesSelector samples={availableSamples} selected={selectedSamples} onToggle={handleSampleToggle} />
          )}
          {job.shareSlug && (
            <ShareLinkCallout shareLink={shareLink} profileSlug={session?.profileSlug} jobSlug={job.shareSlug} />
          )}
          {proof && (
            <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-3 text-[11px] text-muted-foreground">
              Edits below are local for drafting. Regenerate to pull fresh model output—evidence + citations stay untouched.
            </div>
          )}
          {proof ? (
            <div className="grid gap-6">
              <section className="space-y-2">
                <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Key requirements</h3>
                  <p className="text-xs text-muted-foreground">Requirement text stays locked; jot your own talking points below.</p>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {proof.requirements.map((requirement) => {
                    const mappings = proof.mappings.filter((mapping) => {
                      if (mapping.requirementId !== requirement.id) return false;
                      const projectId = mapping.evidence.projectId;
                      if (!projectId) return true;
                      return selectedProjects.has(projectId);
                    });
                    return (
                      <RequirementCard
                        key={requirement.id}
                        requirement={requirement}
                        note={requirementNotes[requirement.id] ?? ""}
                        onNoteChange={(value) =>
                          setRequirementNotes((prev) => ({
                            ...prev,
                            [requirement.id]: value,
                          }))
                        }
                        mappings={mappings}
                      />
                    );
                  })}
                </div>
              </section>
              {proof.codeSamples && proof.codeSamples.length > 0 && <ProofCodeSamplesSection samples={proof.codeSamples} />}
              <section>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Resume bullets</h3>
                  <p className="text-xs text-muted-foreground">Edit locally, copy fast. Reset to regenerate text.</p>
                </div>
                <div className="mt-3 space-y-3">
                  {bulletDrafts.map((bullet, index) => (
                    <EditableCopyRow
                      key={index}
                      text={bullet}
                      original={proof.bullets[index] ?? ""}
                      label={`Bullet ${index + 1}`}
                      onChange={(value) =>
                        setBulletDrafts((prev) => {
                          const next = [...prev];
                          next[index] = value;
                          return next;
                        })
                      }
                    />
                  ))}
                </div>
              </section>
              <section>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Outreach note</h3>
                <p className="text-xs text-muted-foreground">Tweak the copy inline for email/DM but keep citations untouched.</p>
                <EditableCopyRow text={outreachDraft} original={proof.outreachNote} label="Outreach" onChange={setOutreachDraft} multiline />
              </section>
              <section>
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Evidence citations</h3>
                  <p className="text-xs text-muted-foreground">Every claim above links back to a repo file or doc so reviewers can audit it.</p>
                </div>
                {filteredCitations.length === 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">No code references yet.</p>
                ) : (
                  <div className="mt-3 space-y-3">
                    {filteredCitations.map((evidence) => (
                      <div key={evidence.id} className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4 text-xs text-slate-300">
                        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-500">
                          {evidence.fileUrl || evidence.repoPath || evidence.projectFullName}
                        </div>
                        {evidence.description && <p className="text-sm text-white">{evidence.description}</p>}
                        {evidence.fileUrl && (
                          <a href={evidence.fileUrl} target="_blank" rel="noopener noreferrer nofollow" className="text-accent">
                            View source
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No proof yet. Run generation once you have projects selected.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ProjectSelector({ projects, selected, onChange }: { projects: Project[]; selected: Set<string>; onChange: (value: Set<string>) => void }) {
  const toggleProject = (projectId: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(projectId);
    else next.delete(projectId);
    onChange(next);
  };

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">Projects included in this packet</p>
      <p className="text-[11px] text-muted-foreground">Only checked projects will feed requirements and bullets.</p>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {projects.map((project) => (
          <label
            key={project.id}
            className="flex cursor-pointer items-start gap-3 rounded-xl border border-transparent px-3 py-2 hover:border-slate-700"
          >
            <Checkbox checked={selected.has(project.id)} onCheckedChange={(value) => toggleProject(project.id, Boolean(value))} />
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-white">{project.fullName}</p>
                <Badge variant={project.sourceType === "link" ? "outline" : "default"} className="text-[10px]">
                  {project.sourceType === "link" ? "Link" : "GitHub"}
                </Badge>
              </div>
              {project.description && <p className="text-xs text-muted-foreground">{project.description}</p>}
              {project.htmlUrl && (
                <a href={project.htmlUrl} target="_blank" rel="noopener noreferrer nofollow" className="text-[11px] text-accent">
                  {getHost(project.htmlUrl)}
                </a>
              )}
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}

type SampleOption = ProjectCodeSample & {
  id: string;
  projectId: string;
  projectFullName: string;
};

function CodeSamplesSelector({
  samples,
  selected,
  onToggle,
}: {
  samples: SampleOption[];
  selected: Set<string>;
  onToggle: (sampleId: string, checked: boolean) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4">
      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Attach code samples</p>
          <p className="text-[11px] text-muted-foreground">Pick up to 3 snippets to surface in this packet.</p>
        </div>
        <p className="text-[11px] text-muted-foreground">{selected.size}/3 selected</p>
      </div>
      <div className="mt-3 grid gap-2">
        {samples.map((sample) => {
          const isExpanded = expandedId === sample.id;
          return (
            <div key={sample.id} className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-3 text-xs text-muted-foreground">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <label className="flex flex-1 cursor-pointer items-start gap-3">
                  <Checkbox checked={selected.has(sample.id)} onCheckedChange={(value) => onToggle(sample.id, Boolean(value))} />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-white">{sample.summary}</p>
                    <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">
                      {sample.projectFullName} {formatLineLabel(sample.filePath, sample.lineStart, sample.lineEnd)}
                    </p>
                    {sample.tags && sample.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {sample.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-[10px]">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="self-start"
                  onClick={() => setExpandedId(isExpanded ? null : sample.id)}
                >
                  {isExpanded ? "Hide snippet" : "View snippet"}
                </Button>
              </div>
              {isExpanded && (
                <div className="mt-3 space-y-2">
                  {sample.url && (
                    <a href={sample.url} target="_blank" rel="noopener noreferrer nofollow" className="text-[11px] text-primary underline">
                      View source
                    </a>
                  )}
                  <CodeSnippet code={sample.code} language={sample.language || inferLanguage(sample.filePath) || "tsx"} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProofCodeSamplesSection({ samples }: { samples: ProofPacketCodeSample[] }) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Code samples</h3>
        <p className="text-xs text-muted-foreground">Short, user-curated snippets with direct repo links.</p>
      </div>
      <div className="grid gap-3">
        {samples.map((sample) => (
          <div key={sample.id} className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-3 text-xs text-muted-foreground">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-white">{sample.summary}</p>
                <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">
                  {sample.projectFullName} {formatLineLabel(sample.filePath, sample.lineStart, sample.lineEnd)}
                </p>
                {sample.tags && sample.tags.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {sample.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-[10px]">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              {sample.url && (
                <a href={sample.url} target="_blank" rel="noopener noreferrer nofollow" className="text-[11px] text-primary underline">
                  Proof link
                </a>
              )}
            </div>
            <div className="mt-3">
              <CodeSnippet code={sample.code} language={sample.language || inferLanguage(sample.filePath) || "tsx"} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function formatLineLabel(filePath?: string, start?: number, end?: number) {
  const path = filePath || "snippet";
  if (start && end) return `${path} #L${start}-${end}`;
  if (start) return `${path} #L${start}`;
  return path;
}

function RequirementCard({
  requirement,
  mappings,
  note,
  onNoteChange,
}: {
  requirement: Requirement;
  mappings: EvidenceMappingWithEvidence[];
  note: string;
  onNoteChange: (value: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4 space-y-3">
      <div className="space-y-2">
        <div className="rounded-xl border border-slate-800/80 bg-slate-950/70 p-3">
          <p className="text-[11px] uppercase tracking-[0.35em] text-muted-foreground">JD requirement</p>
          <p className="mt-1 text-sm font-semibold text-white">{requirement.text}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
            Priority {requirement.priority}
          </Badge>
          <span>Evidence: {mappings.length || "0"} project{mappings.length === 1 ? "" : "s"}</span>
        </div>
      </div>
      <div className="space-y-2">
        {mappings.length > 0 ? (
          mappings.map((mapping) => (
            <div key={mapping.id} className="rounded-lg border border-slate-800/80 p-3 text-xs text-muted-foreground">
              <p className="font-semibold text-white">{mapping.evidence.projectFullName}</p>
              {mapping.evidence.description && <p>{mapping.evidence.description}</p>}
              {mapping.evidence.fileUrl && (
                <a href={mapping.evidence.fileUrl} target="_blank" rel="noreferrer" className="text-accent">
                  Proof link
                </a>
              )}
            </div>
          ))
        ) : (
          <p className="text-xs text-muted-foreground">No mapped evidence yet.</p>
        )}
      </div>
      <div className="space-y-1">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Your emphasis (visible only to you)</p>
        <Textarea
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
          rows={3}
          placeholder="Clarify how your repo covers this requirement or what to emphasize live."
          className="bg-slate-950/80 text-sm"
        />
      </div>
    </div>
  );
}

function EditableCopyRow({
  text,
  original,
  label,
  onChange,
  multiline,
}: {
  text: string;
  original: string;
  label: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
  };

  const resetDisabled = text === original;

  return (
    <div className="space-y-2 rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          {!resetDisabled && <Badge variant="outline">Edited</Badge>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={handleCopy}>
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button variant="ghost" size="sm" disabled={resetDisabled} onClick={() => onChange(original)}>
            Reset
          </Button>
        </div>
      </div>
      <Textarea
        value={text}
        onChange={(event) => onChange(event.target.value)}
        rows={multiline ? 5 : 3}
        className="bg-slate-950/80 text-sm"
        placeholder="Tighten phrasing or add context. Copy when ready."
      />
      <p className="text-[11px] text-muted-foreground">Only copied text is shared; packet citations stay read-only until you regenerate.</p>
    </div>
  );
}

function ShareLinkCallout({
  shareLink,
  profileSlug,
  jobSlug,
}: {
  shareLink: string;
  profileSlug?: string;
  jobSlug?: string;
}) {
  const handleCopy = async () => {
    if (!shareLink) return;
    await navigator.clipboard.writeText(shareLink);
    toast("Share link copied", { description: shareLink });
  };
  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Shareable Proof Packet URL</p>
          <p className="font-mono text-sm text-white">
            {profileSlug && jobSlug ? `/users/${profileSlug}/${jobSlug}` : "Set your proof profile handle first"}
          </p>
          <p className="text-xs text-muted-foreground">
            This link always reflects the projects you selected, so reviewers know you curated it for their team.
          </p>
          {!profileSlug && (
            <p className="text-xs text-amber-400">
              Configure your handle on the{" "}
              <Link to="/profile" className="underline">
                Profile page
              </Link>{" "}
              to unlock share links.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/profile">Profile</Link>
          </Button>
          <Button variant="outline" size="sm" onClick={handleCopy} disabled={!shareLink}>
            Copy link
          </Button>
        </div>
      </div>
    </div>
  );
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

function getNextStatus(current: Job["status"]): Job["status"] | null {
  const idx = STATUS_ORDER.indexOf(current);
  if (idx === -1 || idx + 1 >= STATUS_ORDER.length) return null;
  return STATUS_ORDER[idx + 1];
}

function getStatusMeta(status: Job["status"]): { label: string; variant: "default" | "outline" | "success" | "warning" } {
  switch (status) {
    case "PROOF_GENERATED":
      return { label: "Proof ready", variant: "default" };
    case "APPLIED":
      return { label: "Applied", variant: "success" };
    case "INTERVIEW":
      return { label: "Interview", variant: "success" };
    case "REJECTED":
      return { label: "Rejected", variant: "warning" };
    case "OFFER":
      return { label: "Offer", variant: "success" };
    default:
      return { label: "Draft", variant: "outline" };
  }
}

function getHost(url?: string) {
  if (!url) return "";
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
