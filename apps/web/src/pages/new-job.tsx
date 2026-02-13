import { useMemo, useState, useEffect } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type { Project } from "@evidensify/types";
import { createJob, fetchProjects, generateProof, suggestRequirements } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { CodeSnippet } from "@/components/ui/code-snippet";

export function NewJobPage() {
  const { data: projects, isLoading } = useQuery({ queryKey: ["projects"], queryFn: fetchProjects });
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuggestingRequirements, setIsSuggestingRequirements] = useState(false);
  const [jobDescription, setJobDescription] = useState("");
  const [requirements, setRequirements] = useState<Array<{ id: string; text: string; priority: number; notes?: string }>>([]);
  const [requirementCoverageMap, setRequirementCoverageMap] = useState<Record<string, RequirementCoverageDraft>>({});
  const navigate = useNavigate();
  const publicProjects = useMemo(() => (projects || []).filter((project) => !project.isPrivate), [projects]);
  const privateProjectCount = (projects || []).filter((project) => project.isPrivate).length;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const title = formData.get("title")?.toString().trim() || "";
    const rawDescription = (formData.get("description")?.toString().trim() || jobDescription || "").trim();
    if (!title || !rawDescription) {
      toast("Missing fields", { description: "Add a job title and paste the JD." });
      return;
    }
    const confirmedRequirements = requirements
      .map((entry, index) => ({
        id: entry.id || `req-${index + 1}`,
        text: entry.text.trim(),
        priority: 10 - index,
        notes: entry.notes,
      }))
      .filter((entry) => Boolean(entry.text))
      .slice(0, 5);
    if (confirmedRequirements.length === 0) {
      await handleSuggestRequirements(rawDescription);
      toast("Review suggestions", { description: "Confirm or edit suggested requirements before generating." });
      return;
    }
    if (selectedProjects.size === 0) {
      toast("Select projects", { description: "Choose at least one repo to ground the packet." });
      return;
    }
    const selectedPublic = publicProjects.filter((project) => selectedProjects.has(project.id));
    if (selectedPublic.length === 0) {
      toast("Public evidence required", { description: "Only public links are allowed in Proof Packets." });
      return;
    }
    setIsSubmitting(true);
    try {
      const job = await createJob({
        title,
        company: formData.get("company")?.toString() || undefined,
        rawDescription,
      });
      const coveragePayload = confirmedRequirements
        .map((requirement) => {
          const draft = requirementCoverageMap[requirement.id];
          const projectIds = (draft?.projectIds || []).filter((projectId) => selectedPublic.some((project) => project.id === projectId)).slice(0, 2);
          const sampleId =
            draft?.sampleId && availableSamples.some((sample) => sample.id === draft.sampleId)
              ? draft.sampleId
              : null;
          const rationale = (draft?.rationale || "").trim().slice(0, 240);
          return {
            requirementId: requirement.id,
            projectIds,
            sampleId,
            rationale,
          };
        })
        .filter((entry) => entry.projectIds.length > 0 || entry.sampleId || entry.rationale);

      const shallowMappings = coveragePayload.filter(
        (entry) => (entry.projectIds.length > 0 || entry.sampleId) && entry.rationale.length < 12
      );
      if (shallowMappings.length > 0) {
        toast("Add one-sentence proof", {
          description: "For mapped requirements, explain in one sentence how the evidence proves the requirement.",
        });
        setIsSubmitting(false);
        return;
      }

      const selectedSampleIds = Array.from(new Set(coveragePayload.map((entry) => entry.sampleId).filter(Boolean))) as string[];

      await generateProof(job.id, {
        selectedProjectIds: selectedPublic.map((project) => project.id),
        selectedSampleIds,
        requirements: confirmedRequirements,
        requirementCoverage: coveragePayload,
      });
      toast("Proof packet in progress", { description: "We saved the job and generated your first packet." });
      navigate(`/jobs/${job.id}`);
    } catch (error) {
      toast("Could not generate", { description: (error as Error).message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleProject = (id: string, checked: boolean) => {
    setSelectedProjects((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const availableSamples = useMemo(() => {
    if (!projects) return [];
    return projects
      .filter((project) => selectedProjects.has(project.id))
      .flatMap((project) =>
        (project.codeSamples ?? []).map((sample) => ({
          ...sample,
          projectId: project.id,
          projectFullName: project.fullName,
        }))
      );
  }, [projects, selectedProjects]);

  useEffect(() => {
    setRequirementCoverageMap((prev) => {
      const validReqIds = new Set(requirements.map((entry) => entry.id));
      const validProjectIds = new Set(Array.from(selectedProjects));
      const validSampleIds = new Set(availableSamples.map((sample) => sample.id));
      const next: Record<string, RequirementCoverageDraft> = {};
      let changed = false;

      Object.entries(prev).forEach(([reqId, draft]) => {
        if (!validReqIds.has(reqId)) {
          changed = true;
          return;
        }
        const projectIds = (draft.projectIds || []).filter((id) => validProjectIds.has(id)).slice(0, 2);
        const sampleId = draft.sampleId && validSampleIds.has(draft.sampleId) ? draft.sampleId : null;
        const normalized: RequirementCoverageDraft = {
          projectIds,
          sampleId,
          rationale: draft.rationale || "",
        };
        if (
          normalized.projectIds.length !== draft.projectIds.length ||
          normalized.sampleId !== draft.sampleId
        ) {
          changed = true;
        }
        next[reqId] = normalized;
      });

      if (!changed && Object.keys(next).length === Object.keys(prev).length) return prev;
      return next;
    });
  }, [availableSamples, requirements, selectedProjects]);

  const backedCount = useMemo(
    () =>
      requirements.filter((entry) => {
        const coverage = requirementCoverageMap[entry.id];
        return Boolean(coverage && (coverage.projectIds.length > 0 || coverage.sampleId));
      }).length,
    [requirements, requirementCoverageMap]
  );
  const attachedSampleCount = useMemo(() => {
    const ids = new Set(
      Object.values(requirementCoverageMap)
        .map((entry) => entry.sampleId)
        .filter(Boolean)
    );
    return ids.size;
  }, [requirementCoverageMap]);

  const handleRequirementChange = (id: string, nextText: string) => {
    setRequirements((prev) => prev.map((entry) => (entry.id === id ? { ...entry, text: nextText } : entry)));
  };

  const handleRemoveRequirement = (id: string) => {
    setRequirements((prev) => prev.filter((entry) => entry.id !== id).map((entry, index) => ({ ...entry, priority: 10 - index })));
  };

  const handleAddRequirement = () => {
    setRequirements((prev) => {
      if (prev.length >= 5) return prev;
      return [...prev, { id: `req-${Date.now()}`, text: "", priority: 10 - prev.length }];
    });
  };

  const handleSuggestRequirements = async (descriptionOverride?: string) => {
    const text = (descriptionOverride || jobDescription || "").trim();
    if (!text) {
      toast("Add job description", { description: "Paste the JD first so we can suggest requirements." });
      return;
    }
    setIsSuggestingRequirements(true);
    try {
      const response = await suggestRequirements(text);
      const next = (response.requirements || [])
        .map((entry, index) => ({
          id: entry.id || `req-${index + 1}`,
          text: (entry.text || "").trim(),
          priority: typeof entry.priority === "number" ? entry.priority : 10 - index,
          notes: entry.notes,
        }))
        .filter((entry) => Boolean(entry.text))
        .slice(0, 5)
        .map((entry, index) => ({ ...entry, priority: 10 - index }));
      setRequirements(next);
      toast("Requirements suggested", { description: "Confirm, edit, or remove before generating." });
    } catch (error) {
      toast("Could not suggest", { description: (error as Error).message });
    } finally {
      setIsSuggestingRequirements(false);
    }
  };

  return (
    <Card className="border-slate-800/80 bg-slate-950/40">
      <CardHeader>
        <CardTitle className="text-white">New job</CardTitle>
        <CardDescription>Paste the JD, pick repos, and generate a tailored Proof Packet.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-white">Job title</label>
              <Input name="title" placeholder="e.g. ML Research Intern" className="mt-2" required />
            </div>
            <div>
              <label className="text-sm font-semibold text-white">Company</label>
              <Input name="company" placeholder="Company" className="mt-2" />
            </div>
           
          </div>
          <div>
            <label className="text-sm font-semibold text-white">Job description</label>
            <Textarea
              name="description"
              value={jobDescription}
              onChange={(event) => setJobDescription(event.target.value)}
              className="mt-2"
              rows={10}
              placeholder="Paste the JD here"
              required
            />
          </div>
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-sm font-semibold text-white">Suggested requirements</label>
              <Button type="button" variant="outline" size="sm" onClick={() => handleSuggestRequirements()} disabled={isSuggestingRequirements}>
                {isSuggestingRequirements ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Suggest requirements
              </Button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">We suggest up to 5. You must confirm or edit before generate.</p>
            <div className="mt-3 space-y-2">
              {requirements.length === 0 ? (
                <p className="rounded-xl border border-slate-800/80 bg-slate-950/60 px-3 py-3 text-xs text-muted-foreground">
                  No requirements yet. Click “Suggest requirements”.
                </p>
              ) : (
                requirements.map((entry, index) => (
                  <div key={entry.id} className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Requirement {index + 1}</p>
                      <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveRequirement(entry.id)}>
                        Remove
                      </Button>
                    </div>
                    <Input
                      value={entry.text}
                      onChange={(event) => handleRequirementChange(entry.id, event.target.value)}
                      placeholder="Describe one technical requirement"
                    />
                  </div>
                ))
              )}
            </div>
            <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={handleAddRequirement} disabled={requirements.length >= 5}>
              Add requirement
            </Button>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-white">Projects to use</label>
              <p className="text-xs text-muted-foreground">{selectedProjects.size} selected</p>
            </div>
            {isLoading ? (
              <div className="mt-3 h-24 animate-pulse rounded-xl bg-slate-900/60" />
            ) : publicProjects.length > 0 ? (
              <div className="mt-3 grid gap-3">
                {publicProjects.map((project) => (
                  <ProjectRow
                    key={project.id}
                    project={project}
                    checked={selectedProjects.has(project.id)}
                    onCheckedChange={(checked) => toggleProject(project.id, checked)}
                  />
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Save at least one public project first.</p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">Only public links are allowed in Proof Packets.</p>
            {privateProjectCount > 0 ? (
              <p className="mt-1 text-xs text-amber-400">
                {privateProjectCount} private project(s) are blocked. Remove them in Projects before packet generation.
              </p>
            ) : null}
          </div>
          <RequirementEvidenceMapper
            requirements={requirements}
            projects={publicProjects.filter((project) => selectedProjects.has(project.id))}
            samples={availableSamples}
            coverageMap={requirementCoverageMap}
            onCoverageChange={setRequirementCoverageMap}
            backedCount={backedCount}
            attachedSampleCount={attachedSampleCount}
          />
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Generate Proof Packet
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ProjectRow({ project, checked, onCheckedChange }: { project: Project; checked: boolean; onCheckedChange: (checked: boolean) => void }) {
  const host = (() => {
    try {
      return project.htmlUrl ? new URL(project.htmlUrl).hostname : "";
    } catch {
      return "";
    }
  })();
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-slate-800/80 bg-slate-950/40 p-4">
      <Checkbox checked={checked} onCheckedChange={(value) => onCheckedChange(Boolean(value))} className="mt-1" />
      <div className="flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-white">{project.fullName}</p>
          <Badge variant={project.sourceType === "link" ? "outline" : "default"}>{project.sourceType === "link" ? "Link" : "GitHub"}</Badge>
          {project.primaryLanguage && <Badge variant="outline">{project.primaryLanguage}</Badge>}
        </div>
        <p className="text-xs text-muted-foreground">{project.description}</p>
        {host && (
          <a href={project.htmlUrl} target="_blank" rel="noopener noreferrer nofollow" className="text-xs text-accent">
            {host}
          </a>
        )}
      </div>
    </div>
  );
}

type SampleOption = NonNullable<Project["codeSamples"]>[number] & {
  projectId: string;
  projectFullName: string;
};

type RequirementCoverageDraft = {
  projectIds: string[];
  sampleId: string | null;
  rationale: string;
};

function RequirementEvidenceMapper({
  requirements,
  projects,
  samples,
  coverageMap,
  onCoverageChange,
  backedCount,
  attachedSampleCount,
}: {
  requirements: Array<{ id: string; text: string }>;
  projects: Project[];
  samples: SampleOption[];
  coverageMap: Record<string, RequirementCoverageDraft>;
  onCoverageChange: React.Dispatch<React.SetStateAction<Record<string, RequirementCoverageDraft>>>;
  backedCount: number;
  attachedSampleCount: number;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const getCoverage = (requirementId: string): RequirementCoverageDraft => {
    return coverageMap[requirementId] || { projectIds: [], sampleId: null, rationale: "" };
  };

  const toggleProjectForRequirement = (requirementId: string, projectId: string, checked: boolean) => {
    onCoverageChange((prev) => {
      const current = prev[requirementId] || { projectIds: [], sampleId: null, rationale: "" };
      const nextProjectIds = checked
        ? Array.from(new Set([...current.projectIds, projectId])).slice(0, 2)
        : current.projectIds.filter((id) => id !== projectId);
      return {
        ...prev,
        [requirementId]: { ...current, projectIds: nextProjectIds },
      };
    });
  };

  const selectSampleForRequirement = (requirementId: string, sample: SampleOption | null) => {
    onCoverageChange((prev) => {
      const current = prev[requirementId] || { projectIds: [], sampleId: null, rationale: "" };
      const nextSampleId = sample ? sample.id : null;
      const nextProjectIds = sample
        ? Array.from(new Set([...current.projectIds, sample.projectId])).slice(0, 2)
        : current.projectIds;
      return {
        ...prev,
        [requirementId]: { ...current, sampleId: nextSampleId, projectIds: nextProjectIds },
      };
    });
  };

  const updateRationale = (requirementId: string, value: string) => {
    onCoverageChange((prev) => {
      const current = prev[requirementId] || { projectIds: [], sampleId: null, rationale: "" };
      return {
        ...prev,
        [requirementId]: { ...current, rationale: value },
      };
    });
  };

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-950/40 p-4">
      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
        <div>
          <label className="text-sm font-semibold text-white">Code suggestions and mapping</label>
          <p className="text-xs text-muted-foreground">Pick explicit evidence per requirement. LLM suggests, you decide.</p>
        </div>
        <p className="text-xs text-muted-foreground">
          {backedCount}/{requirements.length || 0} backed • {attachedSampleCount} sample{attachedSampleCount === 1 ? "" : "s"} attached
        </p>
      </div>
      <div className="mt-3 space-y-4">
        {requirements.length === 0 ? (
          <p className="rounded-xl border border-slate-800/80 bg-slate-950/60 px-3 py-3 text-xs text-muted-foreground">
            Suggest requirements first to map evidence.
          </p>
        ) : (
          requirements.map((requirement) => {
            const coverage = getCoverage(requirement.id);
            const suggestions = buildSampleSuggestions(requirement.text, samples).slice(0, 3);
            return (
              <div key={requirement.id} className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-3 text-xs text-muted-foreground">
                <p className="text-sm font-semibold text-white">{requirement.text}</p>
                <p className="mt-1 text-[11px] text-slate-400">Select 1-2 projects, then choose one sample if relevant.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {projects.map((project) => (
                    <label key={`${requirement.id}-${project.id}`} className="inline-flex items-center gap-2 rounded-lg border border-slate-800/70 px-2 py-1">
                      <Checkbox
                        checked={coverage.projectIds.includes(project.id)}
                        onCheckedChange={(value) => toggleProjectForRequirement(requirement.id, project.id, Boolean(value))}
                      />
                      <span className="text-[11px] text-slate-200">{project.fullName}</span>
                    </label>
                  ))}
                </div>
                <div className="mt-3 space-y-2">
                  {suggestions.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground">No direct sample suggestions. You can still map projects and explain manually.</p>
                  ) : (
                    suggestions.map((suggestion) => {
                      const isExpanded = expandedId === suggestion.id;
                      return (
                        <div key={suggestion.id} className="rounded-lg border border-slate-800/70 bg-slate-950/70 p-2">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div className="space-y-1">
                              <p className="text-sm font-semibold text-white">{suggestion.summary}</p>
                              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">
                                {suggestion.projectFullName} {formatLineLabel(suggestion.filePath, suggestion.lineStart, suggestion.lineEnd)}
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {suggestion.reasons.map((reason) => (
                                  <Badge key={reason} variant="outline" className="text-[10px]">
                                    {reason}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button type="button" variant={coverage.sampleId === suggestion.id ? "secondary" : "outline"} size="sm" onClick={() => selectSampleForRequirement(requirement.id, coverage.sampleId === suggestion.id ? null : suggestion)}>
                                {coverage.sampleId === suggestion.id ? "Selected" : "Use sample"}
                              </Button>
                              <Button type="button" variant="ghost" size="sm" onClick={() => setExpandedId(isExpanded ? null : suggestion.id)}>
                                {isExpanded ? "Hide" : "Preview"}
                              </Button>
                            </div>
                          </div>
                          {isExpanded ? (
                            <div className="mt-2 space-y-2">
                              {suggestion.url ? (
                                <a href={suggestion.url} target="_blank" rel="noopener noreferrer nofollow" className="text-[11px] text-primary underline">
                                  View source
                                </a>
                              ) : null}
                              <CodeSnippet code={suggestion.code} language={suggestion.language || inferLanguage(suggestion.filePath) || "tsx"} />
                            </div>
                          ) : null}
                        </div>
                      );
                    })
                  )}
                </div>
                <div className="mt-3">
                  <label className="text-[11px] uppercase tracking-[0.2em] text-slate-500">In one sentence, how does this evidence meet the requirement?</label>
                  <Textarea
                    value={coverage.rationale}
                    onChange={(event) => updateRationale(requirement.id, event.target.value)}
                    rows={2}
                    className="mt-1"
                    placeholder="Example: This API handler and tests show production route design and error handling."
                  />
                </div>
                {(coverage.projectIds.length > 0 || coverage.sampleId) && coverage.rationale.trim().length < 12 ? (
                  <p className="mt-2 text-[11px] text-amber-400">Add a clearer one-sentence explanation before generating.</p>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function buildSampleSuggestions(requirementText: string, samples: SampleOption[]): Array<SampleOption & { score: number; reasons: string[] }> {
  const requirementTerms = tokenize(requirementText);
  return samples
    .map((sample) => {
      const sampleText = `${sample.summary} ${sample.filePath || ""} ${sample.tags?.join(" ") || ""} ${sample.code.slice(0, 500)}`.toLowerCase();
      const matchedTerms = requirementTerms.filter((term) => sampleText.includes(term));
      let score = matchedTerms.length;
      if (/\bapi|endpoint|route|handler\b/.test(requirementText.toLowerCase()) && /route|api|endpoint|handler|controller/.test(sampleText)) {
        score += 2;
      }
      if (/\btest|quality|reliability\b/.test(requirementText.toLowerCase()) && /test|spec|assert|pytest|jest/.test(sampleText)) {
        score += 2;
      }
      if (/\bml|model|experiment|eval\b/.test(requirementText.toLowerCase()) && /model|experiment|eval|metric|inference/.test(sampleText)) {
        score += 2;
      }
      return {
        ...sample,
        score,
        reasons: matchedTerms.slice(0, 2).map((term) => `matched: ${term}`),
      };
    })
    .filter((sample) => sample.score > 0)
    .sort((a, b) => b.score - a.score);
}

function tokenize(text: string): string[] {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 4)
    )
  ).slice(0, 20);
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

function formatLineLabel(filePath?: string, start?: number, end?: number) {
  const path = filePath || "snippet";
  if (start && end) return `${path} #L${start}-${end}`;
  if (start) return `${path} #L${start}`;
  return path;
}
