import { useMemo, useState, useEffect } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type { Project } from "@evidensify/types";
import { createJob, fetchProjects, generateProof } from "@/lib/api";
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
  const [selectedSamples, setSelectedSamples] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const title = formData.get("title")?.toString().trim() || "";
    const rawDescription = formData.get("description")?.toString().trim() || "";
    if (!title || !rawDescription) {
      toast("Missing fields", { description: "Add a job title and paste the JD." });
      return;
    }
    if (selectedProjects.size === 0) {
      toast("Select projects", { description: "Choose at least one repo to ground the packet." });
      return;
    }
    setIsSubmitting(true);
    try {
      const job = await createJob({
        title,
        company: formData.get("company")?.toString() || undefined,
        jobUrl: formData.get("jobUrl")?.toString() || undefined,
        rawDescription,
      });
      await generateProof(job.id, {
        selectedProjectIds: Array.from(selectedProjects),
        selectedSampleIds: Array.from(selectedSamples),
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
      if (!changed && next.size === prev.size) return prev;
      return next;
    });
  }, [availableSamples]);

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
            <div className="md:col-span-2">
              <label className="text-sm font-semibold text-white">Job URL</label>
              <Input name="jobUrl" placeholder="https://" className="mt-2" />
            </div>
          </div>
          <div>
            <label className="text-sm font-semibold text-white">Job description</label>
            <Textarea name="description" className="mt-2" rows={10} placeholder="Paste the JD here" required />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-white">Projects to use</label>
              <p className="text-xs text-muted-foreground">{selectedProjects.size} selected</p>
            </div>
            {isLoading ? (
              <div className="mt-3 h-24 animate-pulse rounded-xl bg-slate-900/60" />
            ) : projects && projects.length > 0 ? (
              <div className="mt-3 grid gap-3">
                {projects.map((project) => (
                  <ProjectRow
                    key={project.id}
                    project={project}
                    checked={selectedProjects.has(project.id)}
                    onCheckedChange={(checked) => toggleProject(project.id, checked)}
                  />
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Save at least one project first.</p>
            )}
          </div>
          {availableSamples.length > 0 && (
            <SampleSelector
              samples={availableSamples}
              selected={selectedSamples}
              onToggle={handleSampleToggle}
            />
          )}
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

function SampleSelector({
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
    <div className="rounded-2xl border border-slate-800/80 bg-slate-950/40 p-4">
      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
        <div>
          <label className="text-sm font-semibold text-white">Code samples (optional)</label>
          <p className="text-xs text-muted-foreground">Pick up to 3 curated snippets to include in the first packet.</p>
        </div>
        <p className="text-xs text-muted-foreground">{selected.size}/3 selected</p>
      </div>
      <div className="mt-3 space-y-2">
        {samples.map((sample) => {
          const isExpanded = expandedId === sample.id;
          return (
            <div key={sample.id} className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-3 text-xs text-muted-foreground">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <label className="flex flex-1 cursor-pointer items-start gap-3">
                  <Checkbox checked={selected.has(sample.id)} onCheckedChange={(value) => onToggle(sample.id, Boolean(value))} className="mt-0.5" />
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
                <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => setExpandedId(isExpanded ? null : sample.id)}>
                  {isExpanded ? "Hide code" : "View code"}
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
