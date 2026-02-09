import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchGitHubRepos,
  fetchProjects,
  fetchRepoFileContent,
  fetchRepoFileTree,
  saveProjects,
  suggestSnippetSummary,
  suggestSnippetTags,
  type ApiRepoSummary,
  type ProjectPayload,
  type RepoTreeItem,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Loader2, RefreshCw, Search, Trash2, X, Pencil } from "lucide-react";
import { toast } from "sonner";
import type { AIRole, ProjectCodeSample } from "@evidensify/types";

const CONTEXT_OPTIONS = ["Personal", "Course", "Open Source", "Startup", "Research"];
const AI_ROLE_OPTIONS = [
  { value: "none", label: "No AI" },
  { value: "assist", label: "Assist (autocomplete, Copilot, Cursor)" },
  { value: "co-design", label: "Co-design (AI drafts + your review)" },
  { value: "agent-orchestration", label: "Agent orchestration (built eval/guardrails)" },
];
const MAX_SHOWCASED = 4;
const MAX_SAMPLE_LINES = 40;
const MAX_SAMPLE_CODE_CHARS = 2000;
const PROJECTS_CHECKLIST = [
  {
    title: "Import repos",
    detail: "Pull in the GitHub repos or links you actually want to share. Skip tutorials.",
  },
  {
    title: "Add context & AI usage",
    detail: "Explain design choices, note how you used (or skipped) AI, and add short code samples.",
  },
  {
    title: "Generate packets",
    detail: "Head to Jobs → New job to map these projects to a JD-specific Proof Packet.",
  },
];

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
          return {
            ...rest,
            sourceType: rest.sourceType ?? "github",
            codeSamples: rest.codeSamples ?? [],
            aiRole: rest.aiRole,
            aiTools: rest.aiTools ?? [],
            aiSupervisionNotes: rest.aiSupervisionNotes,
          };
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
          return {
            ...rest,
            sourceType: rest.sourceType ?? "github",
            codeSamples: rest.codeSamples ?? [],
            aiRole: rest.aiRole,
            aiTools: rest.aiTools ?? [],
            aiSupervisionNotes: rest.aiSupervisionNotes,
          };
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
        defaultBranch: repo.defaultBranch,
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
        aiRole: "none",
        aiTools: [],
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
      aiRole: "none",
      aiTools: [],
    };
    setProjects((prev) => [newProject, ...prev]);
    setExternalForm(createEmptyExternalForm());
    setShowExternalForm(false);
    toast("Project added", { description: "External project staged. Don't forget to save changes." });
  };

  const updateProject = (projectId: string, changes: Partial<EditableProject>) => {
    setProjects((prev) => prev.map((project) => (project.id === projectId ? { ...project, ...changes } : project)));
  };
  const handleAiToolsChange = (projectId: string, value: string) => {
    const tools = value
      .split(",")
      .map((token) => token.trim())
      .filter(Boolean);
    updateProject(projectId, { aiTools: tools });
  };

  const toggleShowcased = (projectId: string, nextState: boolean) => {
    if (nextState && showcasedCount >= MAX_SHOWCASED) {
      toast("Limit reached", { description: "You can showcase up to 4 projects." });
      return;
    }
    updateProject(projectId, { isShowcased: nextState });
  };

  const removeProject = (projectId: string) => {
    setProjects((prev) => prev.filter((project) => project.id !== projectId));
    toast("Project removed", { description: "It will be excluded unless you re-import it." });
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
      <div className="rounded-2xl border border-slate-800/70 bg-slate-950/50 p-5">
        <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">Setup checklist</p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {PROJECTS_CHECKLIST.map((step, index) => (
            <div key={step.title} className="rounded-xl border border-slate-800/70 bg-slate-950/70 p-4">
              <div className="text-sm font-semibold text-accent">Step {index + 1}</div>
              <p className="mt-1 text-sm font-semibold text-white">{step.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{step.detail}</p>
            </div>
          ))}
        </div>
      </div>
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
                    <Button variant="ghost" size="sm" onClick={() => removeProject(project.id)}>
                      Remove
                    </Button>
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
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Describe design choices, tools, what you learned, and any limitations. Use your own words; AI can help polish, but only include facts you can defend.
                  </p>
                  <Textarea
                    className="mt-2"
                    rows={3}
                    value={project.description || ""}
                    onChange={(event) => updateProject(project.id, { description: event.target.value })}
                    placeholder="Short reminder of the problem, stack, and key outcomes."
                  />
                </div>
                <div className="mt-4 rounded-2xl border border-slate-800/70 bg-slate-950/50 p-4 text-xs text-muted-foreground">
                  <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">AI usage (optional)</p>
                  <p className="mt-2">
                    Recruiters care less about whether you used AI and more about how you used it. Be specific and honest. It's fine if a project used no AI at all.
                  </p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <label className="space-y-1 text-xs text-muted-foreground">
                      Role
                      <select
                        className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-white"
                        value={project.aiRole || ""}
                        onChange={(event) => updateProject(project.id, { aiRole: event.target.value as AIRole || undefined })}
                      >
                        <option value="">Select</option>
                        {AI_ROLE_OPTIONS.map((option) => (
                          <option key={option.value} className="bg-slate-900" value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1 text-xs text-muted-foreground">
                      Tools (comma separated)
                      <Input
                        className="text-sm"
                        value={project.aiTools && project.aiTools.length ? project.aiTools.join(", ") : ""}
                        onChange={(event) => handleAiToolsChange(project.id, event.target.value)}
                        placeholder="Copilot, Cursor"
                      />
                    </label>
                  </div>
                  <label className="mt-3 block space-y-1 text-xs text-muted-foreground">
                    Supervision notes
                    <Textarea
                      rows={2}
                      maxLength={400}
                      value={project.aiSupervisionNotes || ""}
                      onChange={(event) => updateProject(project.id, { aiSupervisionNotes: event.target.value })}
                      placeholder="Example: Reviewed and refactored agent output, added tests for race conditions."
                    />
                  </label>
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

type SampleSelection = {
  filePath: string;
  language: string;
  lineStart: number;
  lineEnd: number;
  sourceUrl: string;
  code: string;
};

interface CodeSamplePickerProps {
  project: EditableProject;
  open: boolean;
  onClose: () => void;
  onSelect: (selection: SampleSelection) => void;
}

type FilePreviewState = {
  path: string;
  lines: string[];
  ref: string;
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
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editingSampleId, setEditingSampleId] = useState<string | null>(null);
  const [draft, setDraft] = useState<SampleDraft>(() => createEmptySampleDraft());
  const [summarySuggestion, setSummarySuggestion] = useState<string | null>(null);
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const summaryMutation = useMutation({
    mutationFn: suggestSnippetSummary,
    onSuccess: (data) => {
      if (data?.suggestion) {
        setSummarySuggestion(data.suggestion);
      } else {
        toast("No suggestion", { description: "The model could not improve this summary." });
      }
    },
    onError: (error: Error) => toast("Could not polish summary", { description: error.message }),
  });
  const tagsMutation = useMutation({
    mutationFn: suggestSnippetTags,
    onSuccess: (data) => {
      if (data?.tags?.length) {
        setTagSuggestions(data.tags);
      } else {
        toast("No tags suggested", { description: "Try adding more context to the summary." });
      }
    },
    onError: (error: Error) => toast("Could not suggest tags", { description: error.message }),
  });
  const openModal = (mode: "create" | "edit", sample?: ProjectCodeSample) => {
    if (mode === "edit" && sample) {
      setDraft({
        summary: sample.summary || "",
        filePath: sample.filePath || "",
        lineStart: sample.lineStart ? sample.lineStart.toString() : "",
        lineEnd: sample.lineEnd ? sample.lineEnd.toString() : "",
        url: sample.url || projectUrl || "",
        language: sample.language || "",
        tags: (sample.tags || []).join(', '),
        code: sample.code || "",
      });
      setEditingSampleId(sample.id);
    } else {
      setDraft(createEmptySampleDraft());
      setEditingSampleId(null);
    }
    setSummarySuggestion(null);
    setTagSuggestions([]);
    setModalMode(mode);
  };
  const closeModal = () => {
    setModalMode(null);
    setEditingSampleId(null);
    setSummarySuggestion(null);
    setTagSuggestions([]);
  };
  const handleDraftChange =
    (field: keyof SampleDraft) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = event.target.value;
      setDraft((prev) => ({ ...prev, [field]: value }));
      if (field === "summary") {
        setSummarySuggestion(null);
      }
      if (field === "summary" || field === "code") {
        setTagSuggestions([]);
      }
    };
  const handleDelete = (sampleId: string) => {
    onChange(samples.filter((sample) => sample.id !== sampleId));
    if (editingSampleId === sampleId) {
      closeModal();
    }
    toast("Sample deleted", { description: "Removed from this project." });
  };
  const upsertSample = () => {
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
    const normalizedTags = draft.tags
      .split(',')
      .map((token) => token.trim())
      .filter(Boolean)
      .slice(0, 5);
    const payload: ProjectCodeSample = {
      id: editingSampleId || generateSampleId(),
      summary: summary.slice(0, 200),
      code,
      filePath: draft.filePath.trim() || undefined,
      lineStart,
      lineEnd,
      url: draft.url.trim() || projectUrl,
      language: (draft.language || inferLanguage(draft.filePath)).toLowerCase() || undefined,
      tags: normalizedTags,
    };
    if (editingSampleId) {
      onChange(samples.map((sample) => (sample.id === editingSampleId ? { ...sample, ...payload } : sample)));
      toast("Sample updated");
    } else {
      onChange([payload, ...samples]);
      toast("Sample added", { description: "Short snippets keep reviewers engaged." });
    }
    closeModal();
  };
  const canUsePicker = project.sourceType !== "link" && Boolean(project.fullName?.includes('/'));
  const handlePickerSelect = (selection: SampleSelection) => {
    setDraft((prev) => ({
      ...prev,
      filePath: selection.filePath,
      language: selection.language,
      lineStart: selection.lineStart.toString(),
      lineEnd: selection.lineEnd.toString(),
      url: selection.sourceUrl,
      code: selection.code,
    }));
    setModalMode((prev) => prev ?? "create");
    setIsPickerOpen(false);
    toast("Snippet captured", { description: "Review the summary and tags, then save." });
  };
  const handleSuggestSummary = () => {
    if (!draft.summary.trim() || !draft.code.trim()) {
      toast("Add summary + code", { description: "Enter both summary and code before polishing." });
      return;
    }
    summaryMutation.mutate({ summary: draft.summary, code: draft.code });
  };
  const handleSuggestTags = () => {
    if (!draft.summary.trim() || !draft.code.trim()) {
      toast("Add summary + code", { description: "Enter both summary and code before suggesting tags." });
      return;
    }
    tagsMutation.mutate({ summary: draft.summary, code: draft.code });
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
        <div className="flex gap-2">
          {canUsePicker ? (
            <Button type="button" variant="secondary" size="sm" onClick={() => setIsPickerOpen(true)}>
              Select from GitHub
            </Button>
          ) : null}
          <Button type="button" variant="ghost" size="sm" onClick={() => openModal('create')}>
            New snippet
          </Button>
        </div>
      </div>
      {samples.length === 0 ? (
        <p className="text-xs text-muted-foreground">No samples saved yet.</p>
      ) : (
        <div className="space-y-3">
          {samples.map((sample) => (
            <div key={sample.id} className="rounded-2xl border border-slate-900/80 bg-slate-950/60 p-3 text-xs text-muted-foreground">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-white line-clamp-2">{sample.summary}</p>
                  <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">
                    {sample.filePath || 'snippet'} {formatLineRange(sample.lineStart, sample.lineEnd)}
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
                  <Button variant="ghost" size="icon" onClick={() => openModal('edit', sample)}>
                    <Pencil className="h-4 w-4" />
                    <span className="sr-only">Edit</span>
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(sample.id)}>
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Delete</span>
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {modalMode ? (
        <SampleEditorModal
          draft={draft}
          mode={modalMode}
          onClose={closeModal}
          onSave={upsertSample}
          onDraftChange={handleDraftChange}
          onSuggestSummary={handleSuggestSummary}
          onSuggestTags={handleSuggestTags}
          summarySuggestion={summarySuggestion}
          tagSuggestions={tagSuggestions}
          summaryPending={summaryMutation.isPending}
          tagsPending={tagsMutation.isPending}
          onSelectFromGitHub={canUsePicker ? () => setIsPickerOpen(true) : undefined}
        />
      ) : null}
      {canUsePicker ? (
        <CodeSamplePicker
          project={project}
          open={isPickerOpen}
          onClose={() => setIsPickerOpen(false)}
          onSelect={handlePickerSelect}
        />
      ) : null}
    </div>
  );
}
interface SampleEditorModalProps {
  draft: SampleDraft;
  mode: "create" | "edit";
  onClose: () => void;
  onSave: () => void;
  onDraftChange: (field: keyof SampleDraft) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onSuggestSummary: () => void;
  onSuggestTags: () => void;
  summarySuggestion: string | null;
  tagSuggestions?: string[];
  summaryPending?: boolean;
  tagsPending?: boolean;
  onSelectFromGitHub?: () => void;
}

function SampleEditorModal({
  draft,
  mode,
  onClose,
  onSave,
  onDraftChange,
  onSuggestSummary,
  onSuggestTags,
  summarySuggestion,
  tagSuggestions,
  summaryPending,
  tagsPending,
  onSelectFromGitHub,
}: SampleEditorModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-800 bg-slate-950 p-6 text-sm text-muted-foreground shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">{mode === "edit" ? "Edit code sample" : "New code sample"}</p>
            <h3 className="text-base font-semibold text-white">{draft.summary || "Untitled snippet"}</h3>
          </div>
          <button type="button" className="rounded-full border border-slate-700 p-2 text-slate-400 hover:text-white" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 space-y-4">
          <div>
            <div className="flex items-center justify-between gap-2">
              <Label>Summary</Label>
              <Button type="button" variant="ghost" size="sm" onClick={onSuggestSummary} disabled={summaryPending}>
                {summaryPending ? "Polishing…" : "Polish summary"}
              </Button>
            </div>
            <Input value={draft.summary} onChange={onDraftChange("summary")} className="mt-2" placeholder="What does this snippet show?" required />
            {summarySuggestion && (
              <div className="mt-2 rounded-xl border border-slate-800/80 bg-slate-950/70 p-3 text-xs text-muted-foreground">
                <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">AI suggestion</p>
                <p className="text-sm text-white">{summarySuggestion}</p>
                <p className="mt-2 text-[11px] text-muted-foreground">Copy in the phrasing you like before saving.</p>
              </div>
            )}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>File path</Label>
              <Input value={draft.filePath} onChange={onDraftChange("filePath")} className="mt-2" placeholder="src/pipelines/features.py" />
            </div>
            <div>
              <Label>Language</Label>
              <Input value={draft.language} onChange={onDraftChange("language")} className="mt-2" placeholder="python" />
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start line</Label>
                <Input type="number" min={1} value={draft.lineStart} onChange={onDraftChange("lineStart")} className="mt-2" />
              </div>
              <div>
                <Label>End line</Label>
                <Input type="number" min={1} value={draft.lineEnd} onChange={onDraftChange("lineEnd")} className="mt-2" />
              </div>
            </div>
            <div>
              <Label>Source URL</Label>
              <Input value={draft.url} onChange={onDraftChange("url")} className="mt-2" placeholder="https://github.com/demo/file#L1-L20" />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between gap-2">
              <Label>Tags</Label>
              <Button type="button" variant="ghost" size="sm" onClick={onSuggestTags} disabled={tagsPending}>
                {tagsPending ? "Suggesting…" : "Suggest tags"}
              </Button>
            </div>
            <Input value={draft.tags} onChange={onDraftChange("tags")} className="mt-2" placeholder="ml, evaluation, guardrails" />
            <p className="mt-1 text-[11px] text-muted-foreground">Comma-separated, up to 5 tags.</p>
            {tagSuggestions && tagSuggestions.length > 0 && (
              <div className="mt-2 rounded-xl border border-slate-800/80 bg-slate-950/70 p-3 text-xs text-muted-foreground">
                <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Suggested tags</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {tagSuggestions.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-[10px]">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">Copy the ones that fit best.</p>
              </div>
            )}
          </div>
          <div>
            <Label>Code</Label>
            <Textarea value={draft.code} onChange={onDraftChange("code")} className="mt-2 font-mono text-xs" rows={6} placeholder="Paste 10–40 lines of code" required />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Limit {MAX_SAMPLE_LINES} lines / {MAX_SAMPLE_CODE_CHARS} characters.
            </p>
          </div>
          <div className="flex items-center justify-between gap-2">
            {onSelectFromGitHub ? (
              <Button type="button" variant="secondary" onClick={onSelectFromGitHub}>
                Select lines from GitHub
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button type="button" onClick={onSave}>
                {mode === "edit" ? "Save changes" : "Add sample"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CodeSamplePicker({ project, open, onClose, onSelect }: CodeSamplePickerProps) {
  const isGitHubProject = project.sourceType !== "link" && Boolean(project.fullName?.includes("/"));
  const defaultBranch = project.defaultBranch || "main";
  const [activeTab, setActiveTab] = useState<"browse" | "link">("browse");
  const [tree, setTree] = useState<RepoTreeItem[]>([]);
  const [treeLoading, setTreeLoading] = useState(false);
  const [treeError, setTreeError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [filePreview, setFilePreview] = useState<FilePreviewState | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null);
  const [blobUrl, setBlobUrl] = useState("");
  const [blobError, setBlobError] = useState<string | null>(null);
  const [blobLoading, setBlobLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    let isMounted = true;
    if (open && isGitHubProject) {
      setTreeLoading(true);
      setTreeError(null);
      fetchRepoFileTree(project.fullName, defaultBranch)
        .then((data) => {
          if (!isMounted) return;
          setTree(data);
        })
        .catch((error: Error) => {
          if (!isMounted) return;
          setTreeError(error.message);
        })
        .finally(() => {
          if (!isMounted) return;
          setTreeLoading(false);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [open, project.fullName, defaultBranch, isGitHubProject]);

  useEffect(() => {
    if (!open) {
      setActiveTab("browse");
      setSelectedPath(null);
      setFilePreview(null);
      setSelection(null);
      setFileError(null);
      setBlobError(null);
    }
  }, [open]);

  if (!open || !isGitHubProject) {
    return null;
  }

  const filteredFiles = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return tree
      .filter((entry) => isSnippetEligible(entry))
      .filter((entry) => entry.path.toLowerCase().includes(term))
      .sort((a, b) => a.path.localeCompare(b.path));
  }, [tree, searchTerm]);

  const selectedLineCount = selection ? selection.end - selection.start + 1 : 0;
  const selectedCode =
    selection && filePreview
      ? filePreview.lines.slice(selection.start - 1, selection.end).join("\n")
      : "";
  const selectedCharCount = selectedCode.length;
  const selectionTooLong = selectedLineCount > MAX_SAMPLE_LINES || selectedCharCount > MAX_SAMPLE_CODE_CHARS;

  const handleFetchFile = async (path: string, refOverride?: string, preset?: { start?: number; end?: number }) => {
    setSelectedPath(path);
    setFileError(null);
    setFileLoading(true);
    setSelection(null);
    try {
      const data = await fetchRepoFileContent(project.fullName, path, refOverride || defaultBranch);
      const normalized = data.content.replace(/\r\n/g, "\n");
      const previewLines = normalized.split("\n");
      setFilePreview({ path: data.path, lines: previewLines, ref: (data.ref as string) || refOverride || defaultBranch });
      if (preset?.start) {
        const start = clampLine(preset.start, previewLines.length);
        const end = clampLine(preset.end ?? preset.start ?? start, previewLines.length);
        setSelection({ start: Math.min(start, end), end: Math.max(start, end) });
      }
    } catch (error) {
      setFileError((error as Error).message);
    } finally {
      setFileLoading(false);
    }
  };

  const handleLineClick = (lineNumber: number) => {
    setSelection((prev) => {
      if (!prev) {
        return { start: lineNumber, end: lineNumber };
      }
      if (prev.start === prev.end) {
        if (lineNumber === prev.start) {
          return prev;
        }
        return { start: Math.min(prev.start, lineNumber), end: Math.max(prev.start, lineNumber) };
      }
      return { start: lineNumber, end: lineNumber };
    });
  };

  const handleLineInputChange = (field: "start" | "end") => (event: ChangeEvent<HTMLInputElement>) => {
    if (!filePreview) return;
    const value = Number.parseInt(event.target.value, 10);
    if (Number.isNaN(value)) {
      setSelection(null);
      return;
    }
    const clamped = clampLine(value, filePreview.lines.length);
    setSelection((prev) => {
      if (!prev) {
        return { start: clamped, end: clamped };
      }
      if (field === "start") {
        return { start: Math.min(clamped, prev.end), end: Math.max(clamped, prev.end) };
      }
      return { start: Math.min(prev.start, clamped), end: Math.max(prev.start, clamped) };
    });
  };

  const handleUseSnippet = () => {
    if (!filePreview || !selection || selectionTooLong || selectedLineCount <= 0) return;
    const language = inferLanguage(filePreview.path) || "text";
    const url = buildGitHubBlobUrl(project.fullName, filePreview.ref, filePreview.path, selection.start, selection.end);
    onSelect({
      filePath: filePreview.path,
      language,
      lineStart: selection.start,
      lineEnd: selection.end,
      sourceUrl: url,
      code: selectedCode,
    });
  };

  const handleBlobSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBlobError(null);
    const parsed = parseGitHubBlobUrl(blobUrl.trim());
    if (!parsed) {
      setBlobError("Enter a valid GitHub blob URL with #L anchors.");
      return;
    }
    const repoFullName = `${parsed.owner}/${parsed.repo}`.toLowerCase();
    if (repoFullName !== project.fullName.toLowerCase()) {
      setBlobError("URL must point to this repository.");
      return;
    }
    setActiveTab("browse");
    setBlobLoading(true);
    try {
      await handleFetchFile(parsed.path, parsed.branch, {
        start: parsed.startLine,
        end: parsed.endLine,
      });
      setBlobError(null);
      setSelectedPath(parsed.path);
    } catch (error) {
      setBlobError((error as Error).message);
    } finally {
      setBlobLoading(false);
    }
  };

  const renderPreview = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-white">
            {filePreview ? filePreview.path : "Select a file"}
          </p>
          <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">{filePreview ? filePreview.ref : ""}</p>
        </div>
        {filePreview ? (
          <button
            type="button"
            className="text-xs text-primary underline"
            onClick={() => {
              setSelection(null);
              setFilePreview(null);
            }}
          >
            Clear file
          </button>
        ) : null}
      </div>
      {fileError ? <p className="text-xs text-red-400">{fileError}</p> : null}
      <div className="h-72 overflow-y-auto rounded-2xl border border-slate-800/80 bg-slate-950/60">
        {fileLoading ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading file…
          </div>
        ) : filePreview ? (
          <div className="text-xs font-mono">
            {filePreview.lines.map((line: string, index: number) => {
              const lineNumber = index + 1;
              const isSelected = selection && lineNumber >= selection.start && lineNumber <= selection.end;
              return (
                <div
                  key={lineNumber}
                  className={cn(
                    "flex border-b border-slate-900/40",
                    isSelected ? "bg-slate-800/60 text-white" : "text-slate-300"
                  )}
                >
                  <button
                    type="button"
                    className="w-12 flex-shrink-0 border-r border-slate-900/40 px-2 text-right text-[11px] text-slate-500 hover:text-white"
                    onClick={() => handleLineClick(lineNumber)}
                  >
                    {lineNumber}
                  </button>
                  <pre className="flex-1 whitespace-pre-wrap px-3 py-1">{line || "\u00A0"}</pre>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Choose a file to preview code.
          </div>
        )}
      </div>
      {filePreview ? (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="flex items-center gap-3">
            <label className="flex flex-col text-xs text-muted-foreground">
              Start line
              <Input
                type="number"
                min={1}
                value={selection?.start ?? ""}
                onChange={handleLineInputChange("start")}
                className="mt-1"
              />
            </label>
            <label className="flex flex-col text-xs text-muted-foreground">
              End line
              <Input
                type="number"
                min={1}
                value={selection?.end ?? ""}
                onChange={handleLineInputChange("end")}
                className="mt-1"
              />
            </label>
            <Button type="button" variant="ghost" size="sm" onClick={() => setSelection(null)}>
              Clear selection
            </Button>
          </div>
          <div className="text-xs text-slate-300">
            <p>
              Lines:{" "}
              <span className={selectionTooLong ? "text-red-400" : "text-white"}>
                {selectedLineCount} / {MAX_SAMPLE_LINES}
              </span>
            </p>
            <p>
              Characters:{" "}
              <span className={selectedCharCount > MAX_SAMPLE_CODE_CHARS ? "text-red-400" : "text-white"}>
                {selectedCharCount} / {MAX_SAMPLE_CODE_CHARS}
              </span>
            </p>
            {selectionTooLong ? (
              <p className="text-red-400">Trim the selection to keep it under the limits.</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );

  const handleOverlayClick = () => {
    setBlobError(null);
    setFileError(null);
    onClose();
  };

  const filteredList = activeTab === "browse" ? filteredFiles : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6"
      role="dialog"
      aria-modal="true"
      onClick={handleOverlayClick}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div>
            <p className="text-sm uppercase tracking-[0.4em] text-slate-500">Select code sample</p>
            <p className="text-base font-semibold text-white">{project.fullName}</p>
          </div>
          <button
            type="button"
            onClick={handleOverlayClick}
            className="rounded-full border border-slate-700 p-2 text-slate-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="border-b border-slate-800 px-6 py-3">
          <div className="inline-flex rounded-full border border-slate-800 bg-slate-950 p-1 text-xs font-medium text-white">
            <button
              type="button"
              className={cn(
                "rounded-full px-3 py-1 transition-colors",
                activeTab === "browse" ? "bg-slate-800 text-white" : "text-slate-400"
              )}
              onClick={() => setActiveTab("browse")}
            >
              Browse files
            </button>
            <button
              type="button"
              className={cn(
                "rounded-full px-3 py-1 transition-colors",
                activeTab === "link" ? "bg-slate-800 text-white" : "text-slate-400"
              )}
              onClick={() => setActiveTab("link")}
            >
              Paste GitHub URL
            </button>
          </div>
        </div>
        <div className="space-y-4 overflow-y-auto px-6 py-4">
          {activeTab === "browse" ? (
            <div className="grid gap-4 md:grid-cols-[280px_1fr]">
              <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-3">
                <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-3">
                  <Search className="h-4 w-4 text-slate-500" />
                  <Input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search files..."
                    className="border-0 bg-transparent text-sm focus-visible:ring-0"
                  />
                </div>
                <div className="mt-3 h-64 overflow-y-auto">
                  {treeLoading ? (
                    <p className="text-center text-xs text-muted-foreground">Loading repository…</p>
                  ) : treeError ? (
                    <p className="text-center text-xs text-red-400">{treeError}</p>
                  ) : filteredList.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No eligible files yet.</p>
                  ) : (
                    <ul className="space-y-1 text-sm">
                      {filteredList.map((file) => {
                        const active = selectedPath === file.path;
                        return (
                          <li key={file.path}>
                            <button
                              type="button"
                              onClick={() => handleFetchFile(file.path)}
                              className={cn(
                                "w-full rounded-xl border px-3 py-2 text-left text-xs transition-colors",
                                active ? "border-accent/60 bg-accent/10 text-white" : "border-slate-800 bg-slate-900/40 text-slate-300"
                              )}
                            >
                              <p className="font-semibold text-white">{file.path.split("/").pop()}</p>
                              <p className="text-[11px] text-slate-400">{file.path}</p>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Only text-based files under {(MAX_SAMPLE_CODE_CHARS * 5).toLocaleString()} bytes are listed. Search for paths like{" "}
                  <code>src/hooks/useRoom.ts</code>.
                </p>
              </div>
              <div>{renderPreview()}</div>
            </div>
          ) : (
            <div className="space-y-4">
              <form onSubmit={handleBlobSubmit} className="space-y-2">
                <Label>GitHub blob URL</Label>
                <Input
                  value={blobUrl}
                  onChange={(event) => setBlobUrl(event.target.value)}
                  placeholder="https://github.com/user/repo/blob/main/src/file.ts#L10-L40"
                />
                {blobError ? <p className="text-xs text-red-400">{blobError}</p> : null}
                <div className="flex gap-2">
                  <Button type="submit" disabled={blobLoading}>
                    {blobLoading ? "Loading…" : "Load snippet"}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setBlobUrl("")}>
                    Clear
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Paste a link directly from GitHub with line numbers (e.g., <code>#L10-L45</code>). Must reference this repository.
                </p>
              </form>
              {renderPreview()}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-slate-800 px-6 py-4">
          <div className="text-xs text-slate-400">
            Snippets are capped at {MAX_SAMPLE_LINES} lines and {MAX_SAMPLE_CODE_CHARS} characters to keep packets readable.
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={handleOverlayClick}>
              Cancel
            </Button>
            <Button type="button" onClick={handleUseSnippet} disabled={!selection || selectionTooLong || !filePreview}>
              Use snippet
            </Button>
          </div>
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

function formatLineRange(start?: number, end?: number) {
  if (!start && !end) return "";
  if (start && end) {
    return `#L${start}-${end}`;
  }
  if (start) return `#L${start}`;
  if (end) return `#L${end}`;
  return "";
}

const EXCLUDED_SAMPLE_SEGMENTS = ["node_modules", "dist", "build", ".next", ".git", ".turbo", ".venv", "__pycache__", ".gradle", ".idea"];
const ALLOWED_SAMPLE_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".py",
  ".rs",
  ".go",
  ".java",
  ".kt",
  ".swift",
  ".rb",
  ".php",
  ".cs",
  ".cpp",
  ".c",
  ".sql",
  ".md",
];
const MAX_PICKER_FILE_BYTES = 350_000;

function isSnippetEligible(entry: RepoTreeItem): boolean {
  if (!entry || !entry.path) return false;
  if (entry.size && entry.size > MAX_PICKER_FILE_BYTES) return false;
  if (isInExcludedDirectory(entry.path)) return false;
  return hasAllowedExtension(entry.path);
}

function hasAllowedExtension(path: string) {
  const lower = path.toLowerCase();
  return ALLOWED_SAMPLE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function isInExcludedDirectory(path: string) {
  return EXCLUDED_SAMPLE_SEGMENTS.some((segment) => path.split("/").includes(segment));
}

function clampLine(value: number | undefined, max: number) {
  if (!value || Number.isNaN(value)) return 1;
  return Math.min(Math.max(1, value), Math.max(1, max));
}

function buildGitHubBlobUrl(fullName: string, ref: string, filePath: string, start: number, end: number) {
  const encodedPath = filePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const safeRef = encodeURIComponent(ref || "main");
  const anchor = start === end ? `#L${start}` : `#L${start}-L${end}`;
  return `https://github.com/${fullName}/blob/${safeRef}/${encodedPath}${anchor}`;
}

function parseGitHubBlobUrl(raw: string) {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (!url.hostname.endsWith("github.com")) return null;
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 5) return null;
    const blobIndex = parts.indexOf("blob");
    if (blobIndex === -1 || blobIndex + 2 >= parts.length) return null;
    const owner = parts[0];
    const repo = parts[1];
    const branch = decodeURIComponent(parts[blobIndex + 1]);
    const path = parts.slice(blobIndex + 2).join("/");
    let startLine: number | undefined;
    let endLine: number | undefined;
    if (url.hash && url.hash.startsWith("#L")) {
      const range = url.hash.slice(2).split("-L");
      startLine = Number.parseInt(range[0], 10);
      if (range[1]) {
        endLine = Number.parseInt(range[1], 10);
      }
    }
    return { owner, repo, branch, path, startLine, endLine };
  } catch {
    return null;
  }
}
