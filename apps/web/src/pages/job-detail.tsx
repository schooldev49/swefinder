/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CommitEntry,
  EvidenceMappingWithEvidence,
  Job,
  CodeSampleType,
  Project,
  ProofPacketCodeSample,
  ProjectCodeSample,
  RequirementCoverage,
  Requirement,
} from "@evidensify/types";
import {
  createJobSample,
  fetchJob,
  fetchProjects,
  generateProof,
  refreshJobSnapshot,
  updateJobRequirements,
  updateJobStatus,
  updateRequirementCoverage,
} from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/hooks/use-session";
import { CodeSnippet } from "@/components/ui/code-snippet";
import { useSEO } from "@/lib/seo";

const STATUS_ORDER: Job["status"][] = ["DRAFT", "PROOF_GENERATED", "APPLIED", "INTERVIEW", "REJECTED", "OFFER"];
const SAMPLE_TYPE_LABELS: Record<string, string> = {
  code: "Code sample",
  readme: "README sample",
  commit: "Commit sample",
};

type JobSampleDraft = {
  projectId: string;
  type: CodeSampleType;
  summary: string;
  code: string;
  language: string;
  filePath: string;
  lineStart: string;
  lineEnd: string;
  url: string;
  tags: string;
  saveToProject: boolean;
};

export function JobDetailPage() {
  const { id } = useParams();
  const jobId = id ?? "";
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const jobQuery = useQuery({ queryKey: ["job", jobId], queryFn: () => fetchJob(jobId), enabled: Boolean(jobId) });
  const projectsQuery = useQuery({ queryKey: ["projects"], queryFn: fetchProjects });
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [selectedSamples, setSelectedSamples] = useState<Set<string>>(new Set());
  const [selectedRequirementId, setSelectedRequirementId] = useState<string | null>(null);
  const [requirementDrafts, setRequirementDrafts] = useState<Requirement[]>([]);
  const [coverageMap, setCoverageMap] = useState<Record<string, RequirementCoverage>>({});
  const [coverageDraft, setCoverageDraft] = useState<RequirementCoverage | null>(null);
  const [sampleDraft, setSampleDraft] = useState<JobSampleDraft>({
    projectId: "",
    type: "code",
    summary: "",
    code: "",
    language: "",
    filePath: "",
    lineStart: "",
    lineEnd: "",
    url: "",
    tags: "",
    saveToProject: false,
  });

  useEffect(() => {
    if (projectsQuery.data) {
      setSelectedProjects(new Set(projectsQuery.data.map((project) => project.id)));
    }
  }, [projectsQuery.data]);

  const job = jobQuery.data?.job;
  const proof = jobQuery.data?.proofPacket;
  const proofSamples = proof?.codeSamples ?? [];
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const profileLink = session?.profileSlug ? `${origin}/u/${session.profileSlug}` : "";
  const packetShortLink = job?.shareToken ? `${origin}/p/${job.shareToken}` : "";
  const pageTitle = job?.title ? `${job.title} packet` : "Job packet detail";
  useSEO({
    title: pageTitle,
    description: "Review and refine job-specific packet mappings, evidence, and share links.",
    path: jobId ? `/jobs/${jobId}` : "/jobs",
    robots: "noindex,nofollow",
  });

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
      setRequirementDrafts([]);
      setSelectedSamples(new Set());
      setCoverageMap({});
      setCoverageDraft(null);
      setSelectedRequirementId(null);
      return;
    }
    setCoverageMap(proof.requirementCoverageMap || {});
    setRequirementDrafts(proof.requirements.slice(0, 5));
    setSelectedRequirementId((prev) => prev ?? proof.requirements[0]?.id ?? null);
    setCoverageDraft(null);
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
        requirements: requirementDrafts.map((requirement, index) => ({
          id: requirement.id,
          text: requirement.text,
          priority: 10 - index,
          notes: requirement.notes,
        })),
      }),
    onSuccess: async (packet) => {
      toast("Job-specific packet refreshed", { description: packet.title });
      await queryClient.invalidateQueries({ queryKey: ["job", jobId] });
    },
    onError: (error: Error) => toast("Could not regenerate packet", { description: error.message }),
  });
  const refreshSnapshotMutation = useMutation({
    mutationFn: () => refreshJobSnapshot(jobId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["job", jobId] });
      toast("Snapshot refreshed", { description: "Updated commit SHAs and evidence dates." });
    },
    onError: (error: Error) => toast("Could not refresh snapshot", { description: error.message }),
  });
  const saveRequirementsMutation = useMutation({
    mutationFn: () =>
      updateJobRequirements(jobId, {
        requirements: requirementDrafts.map((requirement, index) => ({
          id: requirement.id,
          text: requirement.text,
          priority: 10 - index,
          notes: requirement.notes,
        })),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["job", jobId] });
      toast("Requirements saved");
    },
    onError: (error: Error) => toast("Could not save requirements", { description: error.message }),
  });

  const requirementCoverageMutation = useMutation({
    mutationFn: (payload: { requirementId: string; projectIds: string[]; sampleId: string | null; rationale: string }) =>
      updateRequirementCoverage(jobId, payload),
    onSuccess: async (data) => {
      setCoverageMap(data.requirementCoverageMap || {});
      await queryClient.invalidateQueries({ queryKey: ["job", jobId] });
      toast("Requirement coverage saved");
    },
    onError: (error: Error) => toast("Could not save coverage", { description: error.message }),
  });
  const createSampleMutation = useMutation({
    mutationFn: (payload: Parameters<typeof createJobSample>[1]) => createJobSample(jobId, payload),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["job", jobId] });
      if (sampleDraft.saveToProject) {
        await queryClient.invalidateQueries({ queryKey: ["projects"] });
      }
      setCoverageField("sampleId", data.sample.id);
      setSampleDraft((prev) => ({
        ...prev,
        summary: "",
        code: "",
        tags: "",
        lineStart: "",
        lineEnd: "",
      }));
      toast("Sample added", { description: "Attached to this job requirement." });
    },
    onError: (error: Error) => toast("Could not add sample", { description: error.message }),
  });

  const handleSampleToggle = (sampleId: string, checked: boolean) => {
    setSelectedSamples((prev) => {
      const next = new Set(prev);
      if (checked) {
        if (next.size >= 3) {
          toast("Limit reached", { description: "Attach up to 3 samples per packet." });
          return prev;
        }
        next.add(sampleId);
      } else {
        next.delete(sampleId);
      }
      return next;
    });
  };

  const proofRequirements = requirementDrafts.slice(0, 5);
  const selectedRequirement = proofRequirements.find((requirement) => requirement.id === selectedRequirementId) ?? proofRequirements[0] ?? null;
  const activeCoverage = selectedRequirement ? coverageMap[selectedRequirement.id] : undefined;
  const editableCoverage = coverageDraft ?? (selectedRequirement
    ? {
        requirementId: selectedRequirement.id,
        projectIds: [...(activeCoverage?.projectIds || [])],
        sampleId: activeCoverage?.sampleId ?? null,
        rationale: activeCoverage?.rationale ?? "",
      }
    : null);
  const projectOptions = useMemo(() => {
    if (!projectsQuery.data) return [];
    const selectedIds = new Set(selectedProjects);
    return projectsQuery.data.filter((project) => selectedIds.has(project.id));
  }, [projectsQuery.data, selectedProjects]);
  const sampleOptionsForRequirement = useMemo(() => {
    const allowedProjectIds = new Set(editableCoverage?.projectIds || []);
    return proofSamples.filter((sample) => allowedProjectIds.size === 0 || allowedProjectIds.has(sample.projectId));
  }, [editableCoverage?.projectIds, proofSamples]);

  const backedCount = proofRequirements.reduce((count, requirement) => {
    const entry = coverageMap[requirement.id];
    if (!entry) return count;
    if ((entry.projectIds?.length || 0) > 0 || entry.sampleId || (entry.rationale || "").trim().length > 0) {
      return count + 1;
    }
    return count;
  }, 0);
  const strongPacket = backedCount >= 3 && selectedSamples.size >= 1;

  const setCoverageField = <K extends keyof RequirementCoverage>(field: K, value: RequirementCoverage[K]) => {
    if (!selectedRequirement) return;
    setCoverageDraft((prev) => {
      const base: RequirementCoverage = prev ?? {
        requirementId: selectedRequirement.id,
        projectIds: [...(coverageMap[selectedRequirement.id]?.projectIds || [])],
        sampleId: coverageMap[selectedRequirement.id]?.sampleId ?? null,
        rationale: coverageMap[selectedRequirement.id]?.rationale ?? "",
      };
      return { ...base, [field]: value };
    });
  };

  const saveCoverage = () => {
    if (!selectedRequirement || !editableCoverage) return;
    requirementCoverageMutation.mutate({
      requirementId: selectedRequirement.id,
      projectIds: (editableCoverage.projectIds || []).slice(0, 2),
      sampleId: editableCoverage.sampleId ?? null,
      rationale: (editableCoverage.rationale || "").trim().slice(0, 240),
    });
    setCoverageDraft(null);
  };

  useEffect(() => {
    if (!editableCoverage?.projectIds?.length) return;
    setSampleDraft((prev) => {
      if (prev.projectId) return prev;
      return { ...prev, projectId: editableCoverage.projectIds[0] };
    });
  }, [editableCoverage?.projectIds]);

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
            <CardTitle className="text-white">Job-specific packet</CardTitle>
            <CardDescription>
              Evidence-first summary you curate before sharing so startups know you reviewed every proof point yourself.
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refreshSnapshotMutation.mutate()}
              disabled={refreshSnapshotMutation.isPending || !proof}
            >
              {refreshSnapshotMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Refresh snapshot
            </Button>
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
          {job.shareToken && (
            <ShareLinkCallout
              profileLink={profileLink}
              packetShortLink={packetShortLink}
              profileSlug={session?.profileSlug}
            />
          )}
          {proof && (
            <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-3 text-[11px] text-muted-foreground">
              Edits below are local for drafting. Regenerate to pull fresh model output while evidence and citations stay untouched.
            </div>
          )}
          {proof ? (
            <div className="grid gap-6">
              <section className="space-y-2">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Key requirements</h3>
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-muted-foreground">
                      <span>{backedCount}/{proofRequirements.length} backed</span>
                      <span className="mx-2">•</span>
                      <span className={strongPacket ? "text-emerald-300" : "text-slate-400"}>
                        {strongPacket ? "Strong packet" : "Lighter packet"}
                      </span>
                    </div>
                    <Button type="button" size="sm" variant="outline" onClick={() => saveRequirementsMutation.mutate()} disabled={saveRequirementsMutation.isPending}>
                      {saveRequirementsMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Save requirements
                    </Button>
                  </div>
                </div>
                <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                  <div className="space-y-2">
                    {proofRequirements.map((requirement) => {
                      const coverage = coverageMap[requirement.id];
                      const isActive = requirement.id === selectedRequirement?.id;
                      const isCovered =
                        (coverage?.projectIds?.length || 0) > 0 || Boolean(coverage?.sampleId) || Boolean((coverage?.rationale || "").trim());
                      return (
                        <button
                          key={requirement.id}
                          type="button"
                          onClick={() => {
                            setSelectedRequirementId(requirement.id);
                            setCoverageDraft(null);
                          }}
                          className={`w-full rounded-xl border p-3 text-left transition ${
                            isActive ? "border-accent/60 bg-slate-900/70" : "border-slate-800/80 bg-slate-950/60 hover:border-slate-700"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold text-white">{requirement.text}</p>
                            <Badge variant={isCovered ? "success" : "outline"} className="text-[10px] uppercase tracking-wide">
                              {isCovered ? "Backed" : "Unbacked"}
                            </Badge>
                          </div>
                          <p className="mt-2 text-[11px] text-muted-foreground">Priority {requirement.priority}</p>
                        </button>
                      );
                    })}
                  </div>
                  <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4">
                    {selectedRequirement && editableCoverage ? (
                      <RequirementEvidenceEditor
                        requirement={selectedRequirement}
                        onRequirementTextChange={(value) =>
                          setRequirementDrafts((prev) =>
                            prev.map((entry) => (entry.id === selectedRequirement.id ? { ...entry, text: value } : entry))
                          )
                        }
                        projects={projectOptions}
                        selectedProjects={editableCoverage.projectIds || []}
                        onToggleProject={(projectId, checked) => {
                          const next = new Set(editableCoverage.projectIds || []);
                          if (checked) {
                            if (next.size >= 2) return;
                            next.add(projectId);
                          } else {
                            next.delete(projectId);
                          }
                          setCoverageField("projectIds", Array.from(next));
                        }}
                        sampleOptions={sampleOptionsForRequirement}
                        selectedSampleId={(editableCoverage.sampleId as string | null | undefined) ?? null}
                        onSampleChange={(sampleId) => setCoverageField("sampleId", sampleId)}
                        rationale={editableCoverage.rationale || ""}
                        onRationaleChange={(value) => setCoverageField("rationale", value)}
                        onSave={saveCoverage}
                        saving={requirementCoverageMutation.isPending}
                        sampleDraft={sampleDraft}
                        onSampleDraftChange={setSampleDraft}
                        onCreateSample={() => {
                          const summary = sampleDraft.summary.trim();
                          const code = sampleDraft.code.trim();
                          if (!summary || !code || !sampleDraft.projectId) {
                            toast("Missing fields", { description: "Pick a project and add summary + excerpt." });
                            return;
                          }
                          createSampleMutation.mutate({
                            projectId: sampleDraft.projectId,
                            type: sampleDraft.type,
                            summary,
                            code,
                            language: sampleDraft.language || undefined,
                            filePath: sampleDraft.filePath || undefined,
                            lineStart: sampleDraft.lineStart ? Number.parseInt(sampleDraft.lineStart, 10) : undefined,
                            lineEnd: sampleDraft.lineEnd ? Number.parseInt(sampleDraft.lineEnd, 10) : undefined,
                            url: sampleDraft.url || undefined,
                            tags: sampleDraft.tags
                              .split(",")
                              .map((tag) => tag.trim())
                              .filter(Boolean)
                              .slice(0, 5),
                            saveToProject: sampleDraft.saveToProject,
                          });
                        }}
                        creatingSample={createSampleMutation.isPending}
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">Select a requirement to map evidence.</p>
                    )}
                  </div>
                </div>
              </section>
              {proof.codeSamples && proof.codeSamples.length > 0 && <ProofCodeSamplesSection samples={proof.codeSamples} />}
             
              
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
            <p className="text-sm text-muted-foreground">No packet yet. Generate once you have projects selected.</p>
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
              {project.isPrivate ? <PrivateRepoBadge /> : null}
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
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Attach samples</p>
          <p className="text-[11px] text-muted-foreground">Pick up to 3 code, README, or commit snippets to surface in this packet.</p>
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
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-white">{sample.summary}</p>
                      <Badge variant="outline" className="border-accent/60 text-[10px] uppercase tracking-wide text-accent">
                        {getSampleTypeLabel(sample)}
                      </Badge>
                      {sample.isPrivate ? <PrivateRepoBadge /> : null}
                    </div>
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
                <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => setExpandedId(isExpanded ? null : sample.id)}>
                  {isExpanded ? "Hide sample" : "View sample"}
                </Button>
              </div>
              {isExpanded && (
                <div className="mt-3 space-y-2">
                  {sample.url && (
                    <a href={sample.url} target="_blank" rel="noopener noreferrer nofollow" className="text-[11px] text-primary underline">
                      View source
                    </a>
                  )}
                  {sample.type && sample.type !== "code" ? (
                    sample.type === "commit" ? (
                      <CodeSnippet code={sample.code} language="diff" />
                    ) : (
                      <div className="rounded-xl border border-slate-900/70 bg-slate-900/60 p-3 text-sm text-slate-200 whitespace-pre-wrap">
                        {sample.code}
                      </div>
                    )
                  ) : (
                    <CodeSnippet code={sample.code} language={sample.language || inferLanguage(sample.filePath) || "tsx"} />
                  )}
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
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Evidence samples</h3>
        <p className="text-xs text-muted-foreground">
          Optional deep dives (code, docs, commits). They stay collapsed so recruiters can skim.
        </p>
      </div>
      <div className="grid gap-3">
        {samples.map((sample) => {
          const isOpen = expanded.has(sample.id);
          return (
            <div key={sample.id} className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-3 text-xs text-muted-foreground">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-white">{sample.summary}</p>
                    <Badge variant="outline" className="border-accent/60 text-[10px] uppercase tracking-wide text-accent">
                      {getSampleTypeLabel(sample)}
                    </Badge>
                    {sample.isPrivate ? <PrivateRepoBadge /> : null}
                  </div>
                  <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">
                    {sample.projectFullName} {formatLineLabel(sample.filePath, sample.lineStart, sample.lineEnd)}
                  </p>
                  <SampleHighlightMeta sample={sample} />
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
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={() => toggle(sample.id)}
                  >
                    {isOpen ? "Hide sample" : "Preview sample"}
                  </Button>
                </div>
              </div>
                  {isOpen && (
                    <div className="mt-3">
                      {sample.type && sample.type !== "code" ? (
                        sample.type === "commit" ? (
                          <CodeSnippet code={sample.code} language="diff" />
                        ) : (
                          <div className="rounded-xl border border-slate-900/70 bg-slate-900/60 p-3 text-sm text-slate-200 whitespace-pre-wrap">
                            {sample.code}
                          </div>
                        )
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

function formatLineLabel(filePath?: string, start?: number, end?: number) {
  const path = filePath || "snippet";
  if (start && end) return `${path} #L${start}-${end}`;
  if (start) return `${path} #L${start}`;
  return path;
}

function PrivateRepoBadge() {
  return (
    <Badge variant="outline" className="border-amber-400/40 bg-amber-400/10 text-[10px] uppercase tracking-wide text-amber-200">
      Private repo
    </Badge>
  );
}

function SampleHighlightMeta({ sample, variant = "internal" }: { sample?: { type?: string; readmeHeading?: string; commitEntries?: CommitEntry[] }; variant?: "internal" | "public" }) {
  if (!sample) return null;
  const showHeading = sample.type === "readme" && sample.readmeHeading;
  const entries = sample.type === "commit" ? sample.commitEntries ?? [] : [];
  if (!showHeading && entries.length === 0) return null;
  const textClass = variant === "public" ? "text-slate-400" : "text-muted-foreground";
  return (
    <div className="mt-1 space-y-2">
      {showHeading ? <p className={`text-[11px] ${textClass}`}>README section: {sample.readmeHeading}</p> : null}
      {entries.length > 0 ? <CommitTrailList entries={entries} variant={variant} /> : null}
    </div>
  );
}

function CommitTrailList({ entries, variant = "internal" }: { entries: CommitEntry[]; variant?: "internal" | "public" }) {
  if (!entries.length) return null;
  const boxClasses = variant === "public" ? "border-slate-900/70 bg-slate-900/40" : "border-slate-900/70 bg-slate-900/40";
  const textClass = variant === "public" ? "text-slate-300" : "text-slate-200";
  return (
    <div className={`mt-2 rounded-lg border ${boxClasses} p-2 text-[11px]`}> 
      <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Commit trail · {entries.length} entr{entries.length === 1 ? "y" : "ies"}</p>
      <ul className="mt-1 space-y-1">
        {entries.map((entry) => {
          const label = truncateText(entry.message?.split("\n")[0] || entry.sha, 90);
          const shortSha = entry.sha ? entry.sha.slice(0, 7) : "commit";
          return (
            <li key={entry.sha} className="flex items-center gap-2">
              <span className={`flex-1 truncate ${textClass}`}>{label}</span>
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

function truncateText(value: string, max = 80) {
  if (!value) return "";
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

function getSampleTypeLabel(sample?: { type?: string }) {
  return SAMPLE_TYPE_LABELS[sample?.type || "code"] || "Code sample";
}

function RequirementEvidenceEditor({
  requirement,
  onRequirementTextChange,
  projects,
  selectedProjects,
  onToggleProject,
  sampleOptions,
  selectedSampleId,
  onSampleChange,
  rationale,
  onRationaleChange,
  onSave,
  saving,
  sampleDraft,
  onSampleDraftChange,
  onCreateSample,
  creatingSample,
}: {
  requirement: Requirement;
  onRequirementTextChange: (value: string) => void;
  projects: Project[];
  selectedProjects: string[];
  onToggleProject: (projectId: string, checked: boolean) => void;
  sampleOptions: ProofPacketCodeSample[];
  selectedSampleId: string | null;
  onSampleChange: (sampleId: string | null) => void;
  rationale: string;
  onRationaleChange: (value: string) => void;
  onSave: () => void;
  saving?: boolean;
  sampleDraft: JobSampleDraft;
  onSampleDraftChange: (value: JobSampleDraft | ((prev: JobSampleDraft) => JobSampleDraft)) => void;
  onCreateSample: () => void;
  creatingSample?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] uppercase tracking-[0.35em] text-muted-foreground">Selected requirement</p>
        <Textarea
          value={requirement.text}
          onChange={(event) => onRequirementTextChange(event.target.value.slice(0, 240))}
          rows={2}
          className="mt-1 bg-slate-950/80 text-sm"
          placeholder="Requirement text"
        />
        <p className="mt-1 text-[11px] text-muted-foreground">Priority {requirement.priority}</p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-white">Choose 1-2 projects</p>
        <div className="grid gap-2">
          {projects.map((project) => (
            <label key={project.id} className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-800/70 px-3 py-2">
              <Checkbox
                checked={selectedProjects.includes(project.id)}
                onCheckedChange={(value) => onToggleProject(project.id, Boolean(value))}
              />
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm text-white">{project.fullName}</p>
                  {project.isPrivate ? <PrivateRepoBadge /> : null}
                </div>
                {project.description ? <p className="text-xs text-muted-foreground">{project.description}</p> : null}
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-white">Optional sample</p>
        <select
          className="w-full rounded-lg border border-slate-800/80 bg-slate-950/80 px-3 py-2 text-sm text-white"
          value={selectedSampleId ?? ""}
          onChange={(event) => onSampleChange(event.target.value ? event.target.value : null)}
        >
          <option value="">No sample</option>
          {sampleOptions.map((sample) => (
            <option key={sample.id} value={sample.id}>
              {getSampleTypeLabel(sample)} · {sample.projectFullName} · {sample.summary.slice(0, 56)}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-white">Why this proves the requirement</p>
        <Textarea
          value={rationale}
          onChange={(event) => onRationaleChange(event.target.value.slice(0, 240))}
          rows={3}
          placeholder="1-2 sentences, concrete and technical."
          className="bg-slate-950/80 text-sm"
        />
        <p className="text-[11px] text-muted-foreground">{rationale.length}/240</p>
      </div>

      <Button type="button" size="sm" onClick={onSave} disabled={saving}>
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Save requirement evidence
      </Button>

      <div className="space-y-2 rounded-xl border border-slate-800/70 bg-slate-950/70 p-3">
        <p className="text-xs font-semibold text-white">Add sample in this job flow</p>
        <p className="text-[11px] text-muted-foreground">Optional. Keep it short and specific.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <select
            className="rounded-lg border border-slate-800/80 bg-slate-950/80 px-3 py-2 text-sm text-white"
            value={sampleDraft.projectId}
            onChange={(event) => onSampleDraftChange((prev) => ({ ...prev, projectId: event.target.value }))}
          >
            <option value="">Project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.fullName}
              </option>
            ))}
          </select>
          <select
            className="rounded-lg border border-slate-800/80 bg-slate-950/80 px-3 py-2 text-sm text-white"
            value={sampleDraft.type}
            onChange={(event) => onSampleDraftChange((prev) => ({ ...prev, type: event.target.value as CodeSampleType }))}
          >
            <option value="code">Code</option>
            <option value="readme">README</option>
            <option value="commit">Commit trail</option>
          </select>
        </div>
        <Input
          value={sampleDraft.summary}
          onChange={(event) => onSampleDraftChange((prev) => ({ ...prev, summary: event.target.value }))}
          placeholder="What this sample proves"
          className="bg-slate-950/80"
        />
        <Textarea
          value={sampleDraft.code}
          onChange={(event) => onSampleDraftChange((prev) => ({ ...prev, code: event.target.value }))}
          rows={4}
          placeholder="Paste code, README excerpt, or commit list notes."
          className="bg-slate-950/80 text-sm"
        />
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            value={sampleDraft.filePath}
            onChange={(event) => onSampleDraftChange((prev) => ({ ...prev, filePath: event.target.value }))}
            placeholder="file path (optional)"
            className="bg-slate-950/80"
          />
          <Input
            value={sampleDraft.url}
            onChange={(event) => onSampleDraftChange((prev) => ({ ...prev, url: event.target.value }))}
            placeholder="source URL (optional)"
            className="bg-slate-950/80"
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <Input
            value={sampleDraft.lineStart}
            onChange={(event) => onSampleDraftChange((prev) => ({ ...prev, lineStart: event.target.value }))}
            placeholder="start line"
            className="bg-slate-950/80"
          />
          <Input
            value={sampleDraft.lineEnd}
            onChange={(event) => onSampleDraftChange((prev) => ({ ...prev, lineEnd: event.target.value }))}
            placeholder="end line"
            className="bg-slate-950/80"
          />
          <Input
            value={sampleDraft.tags}
            onChange={(event) => onSampleDraftChange((prev) => ({ ...prev, tags: event.target.value }))}
            placeholder="tags: ml,eval"
            className="bg-slate-950/80"
          />
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Checkbox
            checked={sampleDraft.saveToProject}
            onCheckedChange={(value) => onSampleDraftChange((prev) => ({ ...prev, saveToProject: Boolean(value) }))}
          />
          Save to reuse later
        </label>
        <Button type="button" variant="secondary" size="sm" onClick={onCreateSample} disabled={creatingSample}>
          {creatingSample ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Add sample
        </Button>
      </div>
    </div>
  );
}

function ShareLinkCallout({
  profileLink,
  packetShortLink,
  profileSlug,
}: {
  profileLink: string;
  packetShortLink: string;
  profileSlug?: string;
}) {
  const handleCopy = async (value: string, label: string) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    toast(`${label} copied`, { description: value });
  };
  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Share links</p>
          <p className="font-mono text-sm text-white">{profileSlug ? `/u/${profileSlug}` : "Set your proof profile handle first"}</p>
          {packetShortLink ? (
            <p className="font-mono text-sm text-white">{packetShortLink.replace(/^https?:\/\/[^/]+/, "")}</p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            This link always reflects the projects you selected, so reviewers know you curated it for their team.
          </p>
          <div className="mt-2">
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Where to paste this</p>
            <p className="mt-1 text-xs text-slate-400">Resume: use your profile link. Application, email, or LinkedIn note: use the packet link.</p>
          </div>
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
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/profile">Profile</Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleCopy(profileLink, "Profile link")} disabled={!profileLink}>
            Copy profile link
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleCopy(packetShortLink, "Packet link")} disabled={!packetShortLink}>
            Copy packet link
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
