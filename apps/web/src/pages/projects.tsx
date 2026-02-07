import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchGitHubRepos, fetchProjects, saveProjects, type ApiRepoSummary, type ProjectPayload } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Loader2, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CodeSnippet } from "@/components/ui/code-snippet";
import type { ProjectCodeSample } from "@evidensify/types";

const CONTEXT_OPTIONS = ["Personal", "Course", "Open Source", "Startup", "Research"];
const MAX_SHOWCASED = 4;
const MAX_SAMPLE_LINES = 40;
const MAX_SAMPLE_CODE_CHARS = 2000;

type ExternalFormState = {
  title: string;
  url: string;
  description: string;
  techStack: string;
  context: string;
  year: string;
};

const createEmptyExternalForm = (): ExternalFormState => ({
  title: "",
  url: "",
  description: "",
  techStack: "",
  context: "",
  year: "",
});

const generateProjectId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `project-${Date.now()}`;
const generateSampleId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `sample-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const isValidHttpUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    if (!["https:", "http:"].includes(parsed.protocol)) return false;
    if (parsed.protocol === "http:" && parsed.hostname !== "localhost") return false;
    return Boolean(parsed.hostname);
  } catch {
    return false;
  }
};

const getProjectHost = (value?: string) => {
  if (!value) return "";
  try {
    return new URL(value).hostname;
  } catch {
    return "";
  }
};

const formatUpdated = (value?: string) => (value ? new Date(value).toLocaleDateString() : "Recently added");

type EditableProject = ProjectPayload & { draft?: boolean };

type PageItem = { type: "page"; value: number } | { type: "ellipsis"; key: string };

function buildPageItems(totalPages: number, currentPage: number): PageItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => ({ type: "page", value: index + 1 }));
  }

  const items: PageItem[] = [];
  items.push({ type: "page", value: 1 });

  const windowStart = Math.max(2, currentPage - 1);
  const windowEnd = Math.min(totalPages - 1, currentPage + 1);

  if (windowStart > 2) {
    items.push({ type: "ellipsis", key: "start-ellipsis" });
  }

  for (let page = windowStart; page <= windowEnd; page += 1) {
    items.push({ type: "page", value: page });
  }

  if (windowEnd < totalPages - 1) {
    items.push({ type: "ellipsis", key: "end-ellipsis" });
  }

  items.push({ type: "page", value: totalPages });
  return items;
}

export function ProjectsPage() {
  const queryClient = useQueryClient();
  const { data: savedProjects, isLoading } = useQuery({ queryKey: ["projects"], queryFn: fetchProjects });
  const [projects, setProjects] = useState<EditableProject[]>([]);
  const [repos, setRepos] = useState<ApiRepoSummary[]>([]);
  const [repoSearchTerm, setRepoSearchTerm] = useState("");
  const [repoPage, setRepoPage] = useState(1);
  const [selectedRepoIds, setSelectedRepoIds] = useState<Set<string>>(new Set());
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [showExternalForm, setShowExternalForm] = useState(false);
  const [externalForm, setExternalForm] = useState<ExternalFormState>(() => createEmptyExternalForm());
  const showcasedCount = useMemo(() => projects.filter((project) => project.isShowcased).length, [projects]);

  useEffect(() => {
    if (savedProjects) {
      setProjects(
        savedProjects.map((project) => {
          const { userId, ...rest } = project;
          void userId;
          return { ...rest, sourceType: rest.sourceType ?? "github", codeSamples: rest.codeSamples ?? [] };
        })
      );
    }
  }, [savedProjects]);

  const saveMutation = useMutation({
    mutationFn: (payload: EditableProject[]) => saveProjects(payload),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      setProjects(
        data.map((project) => {
          const { userId, ...rest } = project;
          void userId;
          return { ...rest, sourceType: rest.sourceType ?? "github", codeSamples: rest.codeSamples ?? [] };
        })
      );
      toast("Projects saved", { description: "Your proof-ready projects are up to date." });
    },
    onError: (error: Error) => {
      toast("Save failed", { description: error.message });
    },
  });

  const handleImportRepos = async () => {
    try {
      setIsLoadingRepos(true);
      const repoData = await fetchGitHubRepos();
      setRepos(repoData);
      toast("Repos refreshed", { description: "Select the ones you want to include." });
    } catch (error) {
      toast("GitHub error", { description: (error as Error).message });
    } finally {
      setIsLoadingRepos(false);
    }
  };

  const toggleRepoSelection = (id: string, checked: boolean) => {
    setSelectedRepoIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const addSelectedRepos = () => {
    if (!repos.length) return;
    const selectedRepos = repos.filter((repo) => selectedRepoIds.has(repo.id));
    const existingIds = new Set(projects.map((project) => project.id));
    const newEntries: EditableProject[] = selectedRepos
      .filter((repo) => !existingIds.has(repo.id))
      .map((repo) => ({
        id: repo.id,
        sourceType: "github",
        fullName: repo.fullName,
        htmlUrl: repo.htmlUrl,
        description: repo.description,
        primaryLanguage: repo.language,
        topics: repo.topics || [],
        lastUpdated: repo.updatedAt,
        context: undefined,
        demoUrl: undefined,
        year: new Date(repo.updatedAt).getFullYear(),
        draft: true,
        isShowcased: false,
        codeSamples: [],
      }));
    if (!newEntries.length) {
      toast("Already added", { description: "The selected repos are already in your project list." });
      return;
    }
    setProjects((prev) => [...newEntries, ...prev]);
    setSelectedRepoIds(new Set());
    toast("Projects staged", { description: `${newEntries.length} repo(s) ready to save.` });
  };

  const handleExternalInput =
    (field: keyof ExternalFormState) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const value = event.target.value;
      setExternalForm((prev) => ({ ...prev, [field]: value }));
    };

  const handleExternalSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = externalForm.title.trim();
    const url = externalForm.url.trim();
    if (!title || !url) {
      toast("Missing info", { description: "Add a project title and URL." });
      return;
    }
    if (!isValidHttpUrl(url)) {
      toast("Invalid URL", { description: "Use a valid https:// link." });
      return;
    }
    const topics = externalForm.techStack
      .split(",")
      .map((token) => token.trim())
      .filter(Boolean);
    const newProject: EditableProject = {
      id: generateProjectId(),
      sourceType: "link",
      fullName: title,
      htmlUrl: url,
      externalUrl: url,
      description: externalForm.description.trim() || undefined,
      topics,
      lastUpdated: new Date().toISOString(),
      context: externalForm.context || undefined,
      year: externalForm.year ? Number(externalForm.year) : undefined,
      primaryLanguage: topics[0],
      demoUrl: url,
      draft: true,
      isShowcased: false,
      codeSamples: [],
    };
    setProjects((prev) => [newProject, ...prev]);
    setExternalForm(createEmptyExternalForm());
    setShowExternalForm(false);
    toast("Project added", { description: "External project staged. Don't forget to save changes." });
  };

  const updateProject = (projectId: string, changes: Partial<EditableProject>) => {
    setProjects((prev) => prev.map((project) => (project.id === projectId ? { ...project, ...changes } : project)));
  };

  const toggleShowcased = (projectId: string, nextState: boolean) => {
    if (nextState && showcasedCount >= MAX_SHOWCASED) {
      toast("Limit reached", { description: "You can showcase up to 4 projects." });
      return;
    }
    updateProject(projectId, { isShowcased: nextState });
  };

  const handleSave = () => {
    saveMutation.mutate(
      projects.map((project) => {
        const { draft, ...payload } = project;
        void draft;
        return { ...payload, sourceType: payload.sourceType ?? "github" };
      })
    );
  };

  const emptyState = !isLoading && projects.length === 0;
  const reposPerPage = 15;
  const filteredRepos = useMemo(() => {
    if (!repoSearchTerm) return repos;
    const term = repoSearchTerm.toLowerCase();
    return repos.filter((repo) => {
      return (
        repo.fullName.toLowerCase().includes(term) ||
        (repo.description || "").toLowerCase().includes(term) ||
        (repo.language || "").toLowerCase().includes(term)
      );
    });
  }, [repos, repoSearchTerm]);
  const totalRepoPages = Math.max(1, Math.ceil(filteredRepos.length / reposPerPage));
  const safeRepoPage = Math.min(repoPage, totalRepoPages);
  const pagedRepos = useMemo(() => {
    const start = (safeRepoPage - 1) * reposPerPage;
    return filteredRepos.slice(start, start + reposPerPage);
  }, [filteredRepos, safeRepoPage, reposPerPage]);

  useEffect(() => {
    setRepoPage(1);
  }, [repoSearchTerm, repos]);

  return (
    <div className="space-y-6">
      <Card className="border-slate-800/80 bg-slate-950/40">
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-white">Saved projects</CardTitle>
            <CardDescription>These projects—GitHub repos or public links—become the evidence pool for every Proof Packet.</CardDescription>
            <p className="text-xs text-muted-foreground mt-1">
              Showcased projects: {showcasedCount}/{MAX_SHOWCASED}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button variant="ghost" onClick={handleImportRepos} disabled={isLoadingRepos}>
              {isLoadingRepos ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Import GitHub repos
            </Button>
            <Button variant="outline" onClick={() => setShowExternalForm((prev) => !prev)}>
              {showExternalForm ? "Cancel external project" : "Add external project"}
            </Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              Save changes
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading && <div className="h-24 animate-pulse rounded-xl bg-slate-900/60" />}
          {emptyState && <p className="text-sm text-muted-foreground">No projects yet. Import a few GitHub repos to get started.</p>}
          {showExternalForm && (
            <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/60 p-5">
              <h3 className="text-sm font-semibold text-white">Add external project</h3>
              <p className="text-xs text-muted-foreground">
                Link to a live demo, notebook, or write-up that proves your work. These links go straight into Proof Packets.
              </p>
              <form className="mt-4 space-y-4" onSubmit={handleExternalSubmit}>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>Project title</Label>
                    <Input
                      value={externalForm.title}
                      onChange={handleExternalInput("title")}
                      placeholder="Streamlit model monitor"
                      className="mt-2"
                      required
                    />
                  </div>
                  <div>
                    <Label>Project URL</Label>
                    <Input
                      value={externalForm.url}
                      onChange={handleExternalInput("url")}
                      placeholder="https://"
                      className="mt-2"
                      required
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">Public links only. No login walls or localhost.</p>
                  </div>
                </div>
                <div>
                  <Label>Short description</Label>
                  <Textarea
                    value={externalForm.description}
                    onChange={handleExternalInput("description")}
                    rows={3}
                    className="mt-2"
                    placeholder="Explain what you built and why it matters."
                  />
                </div>
                <div>
                  <Label>Tech stack (comma separated)</Label>
                  <Input
                    value={externalForm.techStack}
                    onChange={handleExternalInput("techStack")}
                    placeholder="React, FastAPI, Postgres"
                    className="mt-2"
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>Context</Label>
                    <select
                      className="mt-2 w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm"
                      value={externalForm.context}
                      onChange={handleExternalInput("context")}
                    >
                      <option value="">Select</option>
                      {CONTEXT_OPTIONS.map((option) => (
                        <option key={option} className="bg-slate-900" value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Year</Label>
                    <Input
                      type="number"
                      value={externalForm.year}
                      onChange={handleExternalInput("year")}
                      className="mt-2"
                      placeholder="2024"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button type="submit">Add to projects</Button>
                </div>
              </form>
            </div>
          )}
          <div className="grid gap-4">
            {projects.map((project) => (
              <div key={project.id} className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-semibold text-white">{project.fullName}</p>
                      <Badge variant={project.sourceType === "link" ? "outline" : "default"}>
                        {project.sourceType === "link" ? "Link" : "GitHub"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Updated {formatUpdated(project.lastUpdated)}
                      {project.htmlUrl ? ` • ${getProjectHost(project.htmlUrl)}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant={project.isShowcased ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => toggleShowcased(project.id, !project.isShowcased)}
                      disabled={!project.isShowcased && showcasedCount >= MAX_SHOWCASED}
                    >
                      {project.isShowcased ? "Showcased" : "Showcase"}
                    </Button>
                    {project.topics?.slice(0, 3).map((topic) => (
                      <Badge key={topic} variant="outline">
                        {topic}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <div>
                    <Label>Context</Label>
                    <select
                      className="mt-2 w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm"
                      value={project.context || ""}
                      onChange={(event) => updateProject(project.id, { context: event.target.value || undefined })}
                    >
                      <option value="">Select</option>
                      {CONTEXT_OPTIONS.map((option) => (
                        <option key={option} className="bg-slate-900" value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Year</Label>
                    <Input
                      type="number"
                      value={project.year || ""}
                      onChange={(event) =>
                        updateProject(project.id, { year: event.target.value ? Number(event.target.value) : undefined })
                      }
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label>Demo or doc URL</Label>
                    <Input
                      value={project.demoUrl || ""}
                      onChange={(event) => updateProject(project.id, { demoUrl: event.target.value || undefined })}
                      className="mt-2"
                      placeholder="https://"
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">Must be public. Recruiters will click to verify.</p>
                  </div>
                </div>
                <div className="mt-4">
                  <Label>What did you build?</Label>
                  <Textarea
                    className="mt-2"
                    rows={3}
                    value={project.description || ""}
                    onChange={(event) => updateProject(project.id, { description: event.target.value })}
                    placeholder="Short reminder of the problem, stack, and key outcomes."
                  />
                </div>
                <ProjectCodeSamplesEditor
                  project={project}
                  onChange={(samples) => updateProject(project.id, { codeSamples: samples })}
                  projectUrl={project.htmlUrl}
                />
              </div>
            ))}
          </div>
        </CardContent>
        <CardFooter>
          <p className="text-xs text-muted-foreground">
            Every project needs a public link (GitHub repo, demo, notebook) so recruiters can verify the claim.
          </p>
        </CardFooter>
      </Card>

      {repos.length > 0 && (
        <Card className="border-slate-800/80 bg-slate-950/40">
          <CardHeader>
            <CardTitle className="text-white">Imported GitHub repos</CardTitle>
            <CardDescription>Select repos then add them to your project list.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Input
                value={repoSearchTerm}
                onChange={(event) => setRepoSearchTerm(event.target.value)}
                placeholder="Filter repos..."
                className="sm:max-w-xs"
              />
              <Button variant="secondary" onClick={addSelectedRepos} disabled={selectedRepoIds.size === 0}>
                Add selected ({selectedRepoIds.size})
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Select</TableHead>
                  <TableHead>Repository</TableHead>
                  <TableHead>Language</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedRepos.map((repo) => (
                  <TableRow key={repo.id} className={cn(selectedRepoIds.has(repo.id) && "bg-slate-900/60")}
                  >
                    <TableCell>
                      <Checkbox checked={selectedRepoIds.has(repo.id)} onCheckedChange={(checked) => toggleRepoSelection(repo.id, Boolean(checked))} />
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-white">{repo.fullName}</p>
                        <p className="text-xs text-muted-foreground">{repo.description}</p>
                      </div>
                    </TableCell>
                    <TableCell>{repo.language}</TableCell>
                    <TableCell>{new Date(repo.updatedAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {totalRepoPages > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  Page {safeRepoPage} of {totalRepoPages}
                </span>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={safeRepoPage === 1}
                    onClick={() => setRepoPage((page) => Math.max(1, page - 1))}
                  >
                    Previous
                  </Button>
                  {buildPageItems(totalRepoPages, safeRepoPage).map((item) =>
                    item.type === "page" ? (
                      <Button
                        key={item.value}
                        variant={item.value === safeRepoPage ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setRepoPage(item.value)}
                      >
                        {item.value}
                      </Button>
                    ) : (
                      <span key={item.key} className="px-2 text-muted-foreground">
                        ...
                      </span>
                    )
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={safeRepoPage === totalRepoPages}
                    onClick={() => setRepoPage((page) => Math.min(totalRepoPages, page + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

type SampleDraft = {
  summary: string;
  filePath: string;
  lineStart: string;
  lineEnd: string;
  url: string;
  language: string;
  tags: string;
  code: string;
};

const createEmptySampleDraft = (): SampleDraft => ({
  summary: "",
  filePath: "",
  lineStart: "",
  lineEnd: "",
  url: "",
  language: "",
  tags: "",
  code: "",
});

function ProjectCodeSamplesEditor({
  project,
  onChange,
  projectUrl,
}: {
  project: EditableProject;
  onChange: (samples: ProjectCodeSample[]) => void;
  projectUrl?: string;
}) {
  const samples = project.codeSamples ?? [];
  const [isAdding, setIsAdding] = useState(false);
  const [draft, setDraft] = useState<SampleDraft>(() => createEmptySampleDraft());
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleDraftChange =
    (field: keyof SampleDraft) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setDraft((prev) => ({ ...prev, [field]: event.target.value }));
    };

  const handleAddSample = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const summary = draft.summary.trim();
    const code = draft.code.trim();
    if (!summary || !code) {
      toast("Add details", { description: "Summary and code are required." });
      return;
    }
    if (code.length > MAX_SAMPLE_CODE_CHARS) {
      toast("Snippet too long", { description: `Limit code samples to ${MAX_SAMPLE_CODE_CHARS} characters.` });
      return;
    }
    const lineStart = draft.lineStart ? Math.max(1, Number.parseInt(draft.lineStart, 10)) : undefined;
    let lineEnd = draft.lineEnd ? Math.max(1, Number.parseInt(draft.lineEnd, 10)) : undefined;
    if (lineStart && lineEnd && lineEnd < lineStart) {
      lineEnd = lineStart;
    }
    if (lineStart && lineEnd && lineEnd - lineStart > MAX_SAMPLE_LINES) {
      toast("Range too long", { description: `Keep snippets to ${MAX_SAMPLE_LINES} lines or less.` });
      return;
    }
    const newSample: ProjectCodeSample = {
      id: generateSampleId(),
      summary: summary.slice(0, 200),
      code,
      filePath: draft.filePath.trim() || undefined,
      lineStart,
      lineEnd,
      url: draft.url.trim() || projectUrl,
      language: (draft.language || inferLanguage(draft.filePath)).toLowerCase() || undefined,
      tags: draft.tags
        .split(",")
        .map((token) => token.trim())
        .filter(Boolean)
        .slice(0, 5),
    };
    onChange([newSample, ...(samples ?? [])]);
    setDraft(createEmptySampleDraft());
    setIsAdding(false);
    toast("Sample added", { description: "Short snippets keep reviewers engaged." });
  };

  const handleDelete = (sampleId: string) => {
    onChange(samples.filter((sample) => sample.id !== sampleId));
    if (expandedId === sampleId) {
      setExpandedId(null);
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border border-slate-900/60 bg-slate-950/40 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-white">Code samples (optional)</p>
          <p className="text-xs text-muted-foreground">
            Curate 10–40 line snippets with commentary. You can attach up to 3 per Proof Packet.
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => setIsAdding((prev) => !prev)}>
          {isAdding ? "Cancel" : "Add sample"}
        </Button>
      </div>
      {samples.length === 0 ? (
        <p className="text-xs text-muted-foreground">No samples saved yet.</p>
      ) : (
        <div className="space-y-3">
          {samples.map((sample) => {
            const isExpanded = expandedId === sample.id;
            return (
              <div key={sample.id} className="rounded-2xl border border-slate-900/80 bg-slate-950/60 p-3 text-xs text-muted-foreground">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">{sample.summary}</p>
                    <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">
                      {sample.filePath || "snippet"} {formatLineRange(sample.lineStart, sample.lineEnd)}
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
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="secondary" size="sm" onClick={() => setExpandedId(isExpanded ? null : sample.id)}>
                      {isExpanded ? "Hide code" : "View code"}
                    </Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => handleDelete(sample.id)}>
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Delete sample</span>
                    </Button>
                  </div>
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
      )}
      {isAdding && (
        <form onSubmit={handleAddSample} className="space-y-3 rounded-2xl border border-dashed border-slate-700 p-4">
          <div>
            <Label>Summary</Label>
            <Input value={draft.summary} onChange={handleDraftChange("summary")} className="mt-2" placeholder="What does this snippet show?" required />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>File path</Label>
              <Input value={draft.filePath} onChange={handleDraftChange("filePath")} className="mt-2" placeholder="src/pipelines/features.py" />
            </div>
            <div>
              <Label>Language</Label>
              <Input value={draft.language} onChange={handleDraftChange("language")} className="mt-2" placeholder="python" />
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start line</Label>
                <Input type="number" min={1} value={draft.lineStart} onChange={handleDraftChange("lineStart")} className="mt-2" />
              </div>
              <div>
                <Label>End line</Label>
                <Input type="number" min={1} value={draft.lineEnd} onChange={handleDraftChange("lineEnd")} className="mt-2" />
              </div>
            </div>
            <div>
              <Label>Source URL</Label>
              <Input value={draft.url} onChange={handleDraftChange("url")} className="mt-2" placeholder="https://github.com/demo/file#L1-L20" />
            </div>
          </div>
          <div>
            <Label>Tags</Label>
            <Input value={draft.tags} onChange={handleDraftChange("tags")} className="mt-2" placeholder="ml, evaluation, guardrails" />
            <p className="mt-1 text-[11px] text-muted-foreground">Comma-separated, up to 5 tags.</p>
          </div>
          <div>
            <Label>Code</Label>
            <Textarea value={draft.code} onChange={handleDraftChange("code")} className="mt-2 font-mono text-xs" rows={6} placeholder="Paste 10–40 lines of code" required />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Limit {MAX_SAMPLE_LINES} lines / {MAX_SAMPLE_CODE_CHARS} characters.
            </p>
          </div>
          <div className="flex justify-end">
            <Button type="submit" size="sm">
              Save sample
            </Button>
          </div>
        </form>
      )}
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

function formatLineRange(start?: number, end?: number) {
  if (!start && !end) return "";
  if (start && end) {
    return `#L${start}-${end}`;
  }
  if (start) return `#L${start}`;
  if (end) return `#L${end}`;
  return "";
}
