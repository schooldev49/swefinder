import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import {
  fetchGitHubRepos,
  fetchProjects,
  fetchRepoFileContent,
  fetchRepoFileTree,
  fetchRepoReadmeContent,
  fetchRepoCommitsList,
  fetchRepoCommitDiff,
  saveProjects,
  suggestSnippetSummary,
  suggestSnippetTags,
  type ApiRepoSummary,
  type ProjectPayload,
  type RepoTreeItem,
  type RepoCommitSummary,
  type RepoCommitDiff,
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
import type { AIRole, CodeSampleType, CommitEntry, Project, ProjectCodeSample } from "@evidensify/types";
import { useSEO } from "@/lib/seo";
import { inferLanguageFromPath } from "@/lib/language";

const CONTEXT_OPTIONS = ["Personal", "Course", "Open Source", "Startup", "Research"];
const AI_ROLE_OPTIONS = [
  { value: "none", label: "No AI" },
  { value: "assist", label: "Assist (autocomplete, Copilot, Cursor)" },
  { value: "co-design", label: "Co-design (AI drafts + your review)" },
  { value: "agent-orchestration", label: "Agent orchestration (built eval/guardrails)" },
];
const MAX_SHOWCASED = 3;
const MAX_FEATURED_CODE = 3;
const MAX_FEATURED_COMMIT = 3;
const MAX_FEATURED_README = 1;
const MAX_SAMPLE_LINES = 40;
const MAX_SAMPLE_CODE_CHARS = 2000;
const MAX_PROJECT_DESCRIPTION_CHARS = 280;
const WRITEUP_SITES = ["notion.so", "medium.com", "docs.google.com", "substack.com", "mirror.xyz"];
const DEMO_SITES = ["youtube.com", "codesandbox.io", "figma.com", "youtu.be", "loom.com", "streamlit", "vercel.app", "netlify.app", "azurewebsites"];
const PROJECTS_CHECKLIST = [
  {
    title: "Import repos",
    detail: "Pull in the GitHub repos or links you actually want to share. Skip tutorials.",
  },
  {
    title: "Add context & AI usage",
    detail: "Explain design choices and note how you used (or skipped) AI.",
  },
];

const SAMPLE_TYPE_OPTIONS: Array<{ value: CodeSampleType; label: string; helper: string }> = [
  {
    value: "code",
    label: "Code snippet",
    helper: "Show 10–40 lines of implementation, tests, or evaluators.",
  },
  {
    value: "readme",
    label: "README / doc excerpt",
    helper: "Pull a short section that explains design choices or results.",
  },
  {
    value: "commit",
    label: "Commit trail",
    helper: "Highlight a commit that fixes a bug or ships a notable change.",
  },
];

const SAMPLE_TYPE_LABELS: Record<CodeSampleType, string> = {
  code: "Code sample",
  readme: "README sample",
  commit: "Commit sample",
};

type ExternalFormState = {
  title: string;
  url: string;
  description: string;
  techStack: string;
  context: string;
  yearStart: string;
  yearEnd: string;
  yearPresent: boolean;
};

const createEmptyExternalForm = (): ExternalFormState => ({
  title: "",
  url: "",
  description: "",
  techStack: "",
  context: "",
  yearStart: "",
  yearEnd: "",
  yearPresent: false,
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
const CURRENT_YEAR = new Date().getFullYear();

const toYearValue = (value?: number) => (typeof value === "number" ? String(value) : "");

const formatProjectYearRange = (project: Pick<Project, "year" | "yearStart" | "yearEnd" | "yearPresent">) => {
  if (project.yearStart) {
    if (project.yearPresent) {
      return project.yearStart === CURRENT_YEAR ? String(CURRENT_YEAR) : `${project.yearStart} - Present`;
    }
    if (project.yearEnd && project.yearEnd !== project.yearStart) {
      return `${project.yearStart} - ${project.yearEnd}`;
    }
    return String(project.yearStart);
  }
  if (project.year) return String(project.year);
  return "";
};

const BUZZWORD_PATTERN =
  /\b(scalable|robust|cutting[- ]edge|best[- ]in[- ]class|innovative|synergy|seamless|world[- ]class|optimized|high[- ]performance|impactful|leverag(?:e|ing)|empower|redefine|revolutionize|state[- ]of[- ]the[- ]art|end[- ]to[- ]end|holistic|transformative|next[- ]gen|visionary|dynamic|game[- ]changing|industry[- ]leading)\b/i;

const CONCRETE_SIGNAL_PATTERN =
  /\b(test|latency|error|retry|timeout|schema|validation|commit|line|query|cache|queue|api|endpoint|migration|benchmark|incident|p95|p99|coverage|throughput|memory|cpu|profil(?:e|ing)|trace|log|metrics|alert|monitor|index|join|constraint|transaction|rollback|shard|replica|exception|fail(?:ed|ure)|deploy|hotfix|patch|render|state|hook|bundle|hydration)\b/i;

const METRIC_PATTERN =
  /\b\d+(\.\d+)?\s?(ms|s|%|mb|gb|rps|req|users?|nodes?|threads?|x)\b/i;

  const GENERIC_VERB_PATTERN =
  /\b(built|created|developed|implemented|designed|improved|enhanced|delivered|drove)\b/i;



const TOOL_TERMS = [
  // db / search
  "postgres", "mysql", "sqlite", "mongodb", "dynamodb", "redis", "memcached",
  "elasticsearch", "opensearch", "clickhouse", "bigquery", "snowflake", "redshift",

  // queues / streaming
  "kafka", "rabbitmq", "sqs", "sns", "pubsub", "kinesis", "eventbridge", "pulsar", "nats",

  // cloud / infra
  "aws", "gcp", "azure", "lambda", "cloudflare", "vercel", "netlify",
  "docker", "kubernetes", "terraform", "pulumi", "helm", "nginx",

  // backend / api
  "graphql", "rest", "grpc", "openapi", "swagger", "protobuf",

  // frontend / build
  "react", "next\\.js", "vue", "svelte", "vite", "webpack", "tailwind",

  // ci/cd + obs
  "github actions", "gitlab ci", "jenkins",
  "prometheus", "grafana", "datadog", "sentry", "opentelemetry",

  // auth/payments/comms
  "oauth", "oidc", "jwt"  , "auth0", "clerk",
  "stripe", "twilio", "sendgrid"
];

const TOOL_PATTERN = new RegExp(`\\b(${TOOL_TERMS.join("|")})\\b`, "i");

const MULTIWORD_TOOL_PATTERN =
  /\b(github actions|gitlab ci|new relic|firebase auth)\b/i;


function getConcreteNudge(text?: string): string | null {
  const trimmed = (text || "").trim();
  if (!trimmed) return null;

  const hasBuzz = BUZZWORD_PATTERN.test(trimmed);
  const hasConcrete = CONCRETE_SIGNAL_PATTERN.test(trimmed);
  const hasMetric = METRIC_PATTERN.test(trimmed);
  const hasTool = TOOL_PATTERN.test(trimmed) || MULTIWORD_TOOL_PATTERN.test(trimmed);
  const hasGenericVerb = GENERIC_VERB_PATTERN.test(trimmed);

  const lacksProof = !hasConcrete && !hasMetric && !hasTool;

  if ((hasBuzz && lacksProof) || (hasGenericVerb && lacksProof)) {
    return "This reads a bit high-level. Add one metric, tool, constraint, or design tradeoff.";
  }

  return null;
}

type EditableProject = ProjectPayload & { draft?: boolean };
type ProjectFilter = "all" | "featured" | "needs-edits" | "private-blocked";

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

const toEditableProject = (project: Project): EditableProject => {
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
};

const toProjectPayload = (project: EditableProject): ProjectPayload => {
  const { draft, ...payload } = project;
  void draft;
  return { ...payload, sourceType: payload.sourceType ?? "github" };
};

export function ProjectsPage() {
  useSEO({
    title: "Projects workspace",
    description: "Manage public project evidence, metadata, and featured proof for your public profile.",
    path: "/projects",
    robots: "noindex,nofollow",
  });
  const queryClient = useQueryClient();
  const location = useLocation();
  const { data: savedProjects, isLoading } = useQuery({ queryKey: ["projects"], queryFn: fetchProjects });
  const [projects, setProjects] = useState<EditableProject[]>([]);
  const [repos, setRepos] = useState<ApiRepoSummary[]>([]);
  const [repoSearchTerm, setRepoSearchTerm] = useState("");
  const [repoPage, setRepoPage] = useState(1);
  const [selectedRepoIds, setSelectedRepoIds] = useState<Set<string>>(new Set());
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [showExternalForm, setShowExternalForm] = useState(false);
  const [externalForm, setExternalForm] = useState<ExternalFormState>(() => createEmptyExternalForm());
  const [projectSearchTerm, setProjectSearchTerm] = useState("");
  const [projectFilter, setProjectFilter] = useState<ProjectFilter>("all");
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const showcasedCount = useMemo(() => projects.filter((project) => project.isShowcased).length, [projects]);
  const featuredSampleCounts = useMemo(() => {
    const counts = { code: 0, readme: 0, commit: 0 };
    projects.forEach((project) => {
      (project.codeSamples || []).forEach((sample) => {
        if (!sample.isFeaturedProfile) return;
        const type = sample.type || "code";
        if (type === "code" || type === "readme" || type === "commit") {
          counts[type] += 1;
        }
      });
    });
    return counts;
  }, [projects]);

  useEffect(() => {
    if (savedProjects) {
      setProjects(savedProjects.map(toEditableProject));
    }
  }, [savedProjects]);

  useEffect(() => {
    if (location.hash === "#external") {
      setShowExternalForm(true);
    }
  }, [location.hash]);

  const saveMutation = useMutation({
    mutationFn: (payload: ProjectPayload[]) => saveProjects(payload),
  });

  const persistProjects = (
    nextProjects: EditableProject[],
    options?: { toastTitle?: string; toastDescription?: string }
  ) => {
    const unsupported = findUnsupportedProject(nextProjects);
    if (unsupported) {
      toast("Unsupported link type", {
        description: `${unsupported.fullName}: this URL is currently not supported for strong verification.`,
      });
      return;
    }
    const payload = nextProjects.map((project) => toProjectPayload(project));
    saveMutation.mutate(payload, {
      onSuccess: async (data) => {
        await queryClient.invalidateQueries({ queryKey: ["projects"] });
        setProjects(data.map(toEditableProject));
        if (options?.toastTitle) {
          toast(options.toastTitle, { description: options.toastDescription });
        }
      },
      onError: (error: Error) => {
        toast("Save failed", { description: error.message });
      },
    });
  };

  const applyAndPersist = (
    builder: (current: EditableProject[]) => EditableProject[],
    options?: { toastTitle?: string; toastDescription?: string }
  ) => {
    setProjects((prev) => {
      const next = builder(prev);
      persistProjects(next, options);
      return next;
    });
  };

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
        isPrivate: false,
        isFork: Boolean(repo.fork),
        description: repo.description,
        primaryLanguage: repo.language,
        topics: repo.topics || [],
        lastUpdated: repo.updatedAt,
        context: undefined,
        demoUrl: undefined,
        year: new Date(repo.updatedAt).getFullYear(),
        yearStart: new Date(repo.updatedAt).getFullYear(),
        yearEnd: new Date(repo.updatedAt).getFullYear(),
        yearPresent: false,
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
      if (field === "yearPresent") {
        const checked = (event.target as HTMLInputElement).checked;
        setExternalForm((prev) => ({ ...prev, yearPresent: checked, yearEnd: checked ? "" : prev.yearEnd }));
        return;
      }
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
      isPrivate: false,
      isFork: false,
      description: externalForm.description.trim() || undefined,
      topics,
      lastUpdated: new Date().toISOString(),
      context: externalForm.context || undefined,
      year: externalForm.yearStart ? Number(externalForm.yearStart) : undefined,
      yearStart: externalForm.yearStart ? Number(externalForm.yearStart) : undefined,
      yearEnd: externalForm.yearPresent ? undefined : externalForm.yearEnd ? Number(externalForm.yearEnd) : undefined,
      yearPresent: externalForm.yearPresent,
      primaryLanguage: topics[0],
      demoUrl: url,
      draft: true,
      isShowcased: false,
      codeSamples: [],
      aiRole: "none",
      aiTools: [],
    };
    if (getProjectProofTypes(newProject).includes("Unapproved Link")) {
      toast("Unsupported link type", {
        description: "Use a verifiable project URL (repo, PR/commit, writeup, or known demo host).",
      });
      return;
    }
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
      toast("Limit reached", { description: "You can feature up to 3 projects." });
      return;
    }
    if (!projects.some((project) => project.id === projectId)) {
      return;
    }
    applyAndPersist(
      (current) =>
        current.map((project) => (project.id === projectId ? { ...project, isShowcased: nextState } : project)),
      {
        toastTitle: nextState ? "Project showcased" : "Showcase updated",
        toastDescription: nextState
          ? "This project will appear in Featured projects on your public profile."
          : "It will stay in your list but not be highlighted.",
      }
    );
  };

  const removeProject = (projectId: string) => {
    if (!projects.some((project) => project.id === projectId)) {
      return;
    }
    applyAndPersist(
      (current) => current.filter((project) => project.id !== projectId),
      {
        toastTitle: "Project removed",
        toastDescription: "It won't appear unless you re-import it.",
      }
    );
  };

  const toggleFeaturedSample = (projectId: string, sampleId: string, nextState: boolean) => {
    const project = projects.find((entry) => entry.id === projectId);
    const sample = project?.codeSamples?.find((entry) => entry.id === sampleId);
    if (!project || !sample) return;
    const type = sample.type || "code";
    const limit = type === "readme" ? MAX_FEATURED_README : type === "commit" ? MAX_FEATURED_COMMIT : MAX_FEATURED_CODE;
    const currentCount =
      type === "readme" ? featuredSampleCounts.readme : type === "commit" ? featuredSampleCounts.commit : featuredSampleCounts.code;
    if (nextState && !sample.isFeaturedProfile && currentCount >= limit) {
      toast("Feature limit reached", {
        description:
          type === "readme"
            ? "Feature one README sample max."
            : type === "commit"
              ? "Feature up to 3 commit samples."
              : "Feature up to 3 code samples.",
      });
      return;
    }

    applyAndPersist(
      (current) =>
        current.map((entry) => {
          if (entry.id !== projectId) return entry;
          const nextSamples = (entry.codeSamples || []).map((sampleEntry) =>
            sampleEntry.id === sampleId ? { ...sampleEntry, isFeaturedProfile: nextState } : sampleEntry
          );
          return { ...entry, codeSamples: nextSamples };
        }),
      {
        toastTitle: nextState ? "Added to public profile" : "Removed from public profile",
        toastDescription: nextState ? "Keep only your strongest and most defensible proof." : "It stays saved for optional job-specific links.",
      }
    );
  };

  const handleSave = () => {
    persistProjects(projects, {
      toastTitle: "Projects saved",
      toastDescription: "Your proof-ready projects are up to date.",
    });
  };

  const emptyState = !isLoading && projects.length === 0;
  const hasUnsavedChanges = useMemo(() => {
    const current = JSON.stringify(projects.map((project) => toProjectPayload(project)));
    const persisted = JSON.stringify((savedProjects || []).map((project) => toProjectPayload(toEditableProject(project))));
    return current !== persisted;
  }, [projects, savedProjects]);
  const publicProjects = useMemo(() => projects.filter((project) => !project.isPrivate), [projects]);
  const privateProjects = useMemo(() => projects.filter((project) => project.isPrivate), [projects]);
  const unsupportedProjects = useMemo(
    () => projects.filter((project) => project.sourceType === "link" && getProjectProofTypes(project).includes("Unapproved Link")),
    [projects]
  );
  const filteredPublicProjects = useMemo(() => {
    const term = projectSearchTerm.trim().toLowerCase();
    return publicProjects.filter((project) => {
      if (term && !project.fullName.toLowerCase().includes(term)) return false;
      if (projectFilter === "featured") return Boolean(project.isShowcased);
      if (projectFilter === "needs-edits") {
        return Boolean(getConcreteNudge(project.description)) || !project.context || !project.description;
      }
      return true;
    });
  }, [projectFilter, projectSearchTerm, publicProjects]);
  const visibleProjects = projectFilter === "private-blocked" ? [] : filteredPublicProjects;
  const reposPerPage = 15;
  const filteredRepos = useMemo(() => {
    const publicRepos = repos.filter((repo) => !repo.isPrivate);
    if (!repoSearchTerm) return publicRepos;
    const term = repoSearchTerm.toLowerCase();
    return publicRepos.filter((repo) => {
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
    <div className="space-y-6 pb-16">
      <div className="sticky top-3 z-20 rounded-2xl border border-border bg-card/95 p-4 shadow-lg backdrop-blur">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">Projects workspace</p>
            <p className="text-sm text-muted-foreground">
              {hasUnsavedChanges ? "Unsaved changes" : "All changes saved"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to="/profile">Open public profile</Link>
            </Button>
            <Button variant="ghost" onClick={handleImportRepos} disabled={isLoadingRepos}>
              {isLoadingRepos ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Import GitHub repos
            </Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending || unsupportedProjects.length > 0 || !hasUnsavedChanges}>
              Save changes
            </Button>
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-card/90 p-5">
        <p className="text-sm font-semibold text-foreground">Quick setup</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {PROJECTS_CHECKLIST.map((step, index) => (
            <div key={step.title} className="rounded-xl border border-border bg-card/85 p-4">
              <div className="text-sm font-semibold text-accent">Step {index + 1}</div>
              <p className="mt-1 text-sm font-semibold text-foreground">{step.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{step.detail}</p>
            </div>
          ))}
        </div>
      </div>
      <Card className="border-border bg-card/90">
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-foreground">Saved projects</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">These projects power your public profile.</CardDescription>
            <p className="text-sm text-muted-foreground mt-1">
              Showcased projects: {showcasedCount}/{MAX_SHOWCASED}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button variant="outline" onClick={() => setShowExternalForm((prev) => !prev)}>
              {showExternalForm ? "Cancel external project" : "Add external project"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading && <div className="h-24 animate-pulse rounded-xl bg-card/85" />}
          {emptyState && <p className="text-sm text-muted-foreground">No projects yet. Import a few GitHub repos to get started.</p>}
          {showExternalForm && (
            <div className="rounded-2xl border border-dashed border-border bg-card/85 p-5">
              <h3 className="text-sm font-semibold text-foreground">Add external project</h3>
              <p className="text-xs text-muted-foreground">
                Link to a live demo, notebook, or write-up that proves your work. These links appear on your public profile.
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
                  <Label>What did you build and why does it matter?</Label>
                  <Textarea
                    value={externalForm.description}
                    onChange={handleExternalInput("description")}
                    rows={3}
                    maxLength={MAX_PROJECT_DESCRIPTION_CHARS}
                    className="mt-2"
                    placeholder="Explain what changed, key tradeoff, and where this is verified."
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    What changed? What tradeoff did you make? Where can this be verified?
                  </p>
                  {getConcreteNudge(externalForm.description) ? (
                    <p className="mt-1 text-[11px] text-amber-400">{getConcreteNudge(externalForm.description)}</p>
                  ) : null}
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
                        <option key={option} className="bg-card" value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Year range</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input type="number" value={externalForm.yearStart} onChange={handleExternalInput("yearStart")} placeholder="Start" />
                      <Input
                        type="number"
                        value={externalForm.yearEnd}
                        onChange={handleExternalInput("yearEnd")}
                        placeholder={externalForm.yearPresent ? "Present" : "End"}
                        disabled={externalForm.yearPresent}
                      />
                    </div>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Checkbox checked={externalForm.yearPresent} onCheckedChange={(checked) => setExternalForm((prev) => ({ ...prev, yearPresent: Boolean(checked), yearEnd: checked ? "" : prev.yearEnd }))} />
                      Ongoing (Present)
                    </label>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button type="submit">Add to projects</Button>
                </div>
              </form>
            </div>
          )}
          <p className="text-xs text-muted-foreground">Only public links are allowed in profile proof.</p>
          {privateProjects.length > 0 ? <p className="text-sm text-amber-300">{privateProjects.length} private project(s) are blocked.</p> : null}
          {unsupportedProjects.length > 0 ? (
            <div className="space-y-2 rounded-xl border border-rose-700/60 bg-rose-950/20 p-3">
              <p className="text-xs text-rose-300">
                {unsupportedProjects.length} unsupported link(s) are blocked. Remove them or switch to a supported public host.
              </p>
              <div className="grid gap-2">
                {unsupportedProjects.map((project) => (
                  <div
                    key={project.id}
                    className="flex items-center justify-between rounded-lg border border-rose-800/60 bg-rose-950/30 px-3 py-2 text-xs"
                  >
                    <span className="text-rose-200">{project.fullName}</span>
                    <Button variant="ghost" size="sm" onClick={() => removeProject(project.id)}>
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <div className="rounded-xl border border-border bg-card/85 p-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap gap-2">
                {[
                  { key: "all", label: `All (${publicProjects.length})` },
                  { key: "featured", label: `Featured (${publicProjects.filter((project) => project.isShowcased).length})` },
                  { key: "needs-edits", label: `Needs edits (${publicProjects.filter((project) => Boolean(getConcreteNudge(project.description)) || !project.context || !project.description).length})` },
                  { key: "private-blocked", label: `Private blocked (${privateProjects.length})` },
                ].map((item) => (
                  <Button
                    key={item.key}
                    type="button"
                    size="sm"
                    variant={projectFilter === item.key ? "secondary" : "outline"}
                    onClick={() => setProjectFilter(item.key as ProjectFilter)}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
              <Input
                value={projectSearchTerm}
                onChange={(event) => setProjectSearchTerm(event.target.value)}
                placeholder="Search projects..."
                className="md:max-w-xs"
              />
            </div>
          </div>

          {projectFilter === "private-blocked" ? (
            privateProjects.length > 0 ? (
              <div className="space-y-2 rounded-xl border border-amber-700/60 bg-amber-950/20 p-3">
                {privateProjects.map((project) => (
                  <div key={project.id} className="flex items-center justify-between rounded-lg border border-amber-800/60 bg-amber-950/30 px-3 py-2 text-sm">
                    <span className="text-amber-200">{project.fullName}</span>
                    <Button variant="ghost" size="sm" onClick={() => removeProject(project.id)}>
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No private repositories are currently blocked.</p>
            )
          ) : (
            <div className="grid gap-4">
              {visibleProjects.map((project) => {
                const isExpanded = expandedProjectId === project.id;
                return (
              <div key={project.id} className="rounded-2xl border border-border bg-card/85 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-semibold text-foreground">{project.fullName}</p>
                      <Badge variant={project.sourceType === "link" ? "outline" : "default"}>
                        {project.sourceType === "link" ? "Link" : "GitHub"}
                      </Badge>
                      {project.isFork ? <Badge variant="warning">Fork</Badge> : null}
                      {project.draft || hasUnsavedChanges ? <Badge variant="outline">Unsaved</Badge> : null}
                      {getProjectProofTypes(project)
                        .filter((type) => type !== "Repo")
                        .slice(0, 2)
                        .map((type) => (
                          <Badge key={`${project.id}-${type}`} variant="outline">
                            {type}
                          </Badge>
                        ))}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Updated {formatUpdated(project.lastUpdated)}
                      {project.htmlUrl ? ` • ${getProjectHost(project.htmlUrl)}` : ""}
                    </p>
                    {formatProjectYearRange(project) ? <p className="text-sm text-muted-foreground">Project range: {formatProjectYearRange(project)}</p> : null}
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
                    <Button variant="outline" size="sm" onClick={() => setExpandedProjectId(isExpanded ? null : project.id)}>
                      {isExpanded ? "Collapse" : "Edit"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => removeProject(project.id)}>
                      Remove
                    </Button>
                  </div>
                </div>
                {isExpanded ? (
                  <>
                <div className="mt-4 grid gap-4 md:grid-cols-4">
                  <div>
                    <Label>Context</Label>
                    <select
                      className="mt-2 w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm"
                      value={project.context || ""}
                      onChange={(event) => updateProject(project.id, { context: event.target.value || undefined })}
                    >
                      <option value="">Select</option>
                      {CONTEXT_OPTIONS.map((option) => (
                        <option key={option} className="bg-card" value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Year range</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="number"
                        value={toYearValue(project.yearStart ?? project.year)}
                        onChange={(event) =>
                          updateProject(project.id, {
                            yearStart: event.target.value ? Number(event.target.value) : undefined,
                            year: event.target.value ? Number(event.target.value) : undefined,
                          })
                        }
                        placeholder="Start"
                      />
                      <Input
                        type="number"
                        value={toYearValue(project.yearEnd)}
                        onChange={(event) => updateProject(project.id, { yearEnd: event.target.value ? Number(event.target.value) : undefined })}
                        placeholder={project.yearPresent ? "Present" : "End"}
                        disabled={Boolean(project.yearPresent)}
                      />
                    </div>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Checkbox
                        checked={Boolean(project.yearPresent)}
                        onCheckedChange={(checked) =>
                          updateProject(project.id, {
                            yearPresent: Boolean(checked),
                            yearEnd: checked ? undefined : project.yearEnd,
                          })
                        }
                      />
                      Ongoing (Present)
                    </label>
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
                  <Label>What did you build and why does it matter?</Label>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    What changed? What tradeoff did you make? Where can this be verified?
                  </p>
                  <Textarea
                    className="mt-2"
                    rows={3}
                    maxLength={MAX_PROJECT_DESCRIPTION_CHARS}
                    value={project.description || ""}
                    onChange={(event) => updateProject(project.id, { description: event.target.value })}
                    placeholder="What changed, what tradeoff you made, and where this is verified."
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Keep this brief ({MAX_PROJECT_DESCRIPTION_CHARS} chars max). Mention specific technical decisions so reviewers can verify your reasoning.
                  </p>
                  {getConcreteNudge(project.description) ? (
                    <p className="mt-1 text-[11px] text-amber-400">{getConcreteNudge(project.description)}</p>
                  ) : null}
                </div>
                {project.isFork ? (
                  <div className="mt-3 rounded-xl border border-amber-700/60 bg-amber-950/20 p-3 text-[11px] text-amber-200">
                    This repository is a fork. Add PR, commit, or file-level proof that shows your own contribution.
                  </div>
                ) : null}
               
                <div className="mt-4">
                  <ProjectCodeSamplesEditor
                    project={project}
                    onChange={(samples: ProjectCodeSample[]) => updateProject(project.id, { codeSamples: samples })}
                  />
                </div>
                <div className="mt-4 rounded-2xl border border-border bg-card/80 p-4 text-xs text-muted-foreground">
                  <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Featured proof for public profile</p>
                  <p className="mt-2">
                    Feature only your best proof. Public profile caps: code {featuredSampleCounts.code}/{MAX_FEATURED_CODE}, commit {featuredSampleCounts.commit}/{MAX_FEATURED_COMMIT}, readme {featuredSampleCounts.readme}/{MAX_FEATURED_README}.
                  </p>
                  {(project.codeSamples || []).length === 0 ? (
                    <p className="mt-2 text-[11px] text-muted-foreground">No saved samples yet. Add samples above, then feature the strongest ones here.</p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {(project.codeSamples || []).map((sample) => (
                        <div key={sample.id} className="flex flex-col gap-2 rounded-lg border border-border bg-card/85 p-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm text-foreground">{sample.summary}</p>
                              <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                                {SAMPLE_TYPE_LABELS[sample.type || "code"]}
                              </Badge>
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              {(sample.filePath || "snippet") +
                                (sample.lineStart && sample.lineEnd ? ` #L${sample.lineStart}-${sample.lineEnd}` : "")}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant={sample.isFeaturedProfile ? "secondary" : "outline"}
                            size="sm"
                            onClick={() => toggleFeaturedSample(project.id, sample.id, !sample.isFeaturedProfile)}
                          >
                            {sample.isFeaturedProfile ? "Featured" : "Feature"}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                 <div className="mt-4 rounded-2xl border border-border bg-card/80 p-4 text-xs text-muted-foreground">
                  <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">AI usage (optional)</p>
                  <p className="mt-2">
                    Recruiters care less about whether you used AI and more about how you used it. Be specific and honest. It's fine if a project used no AI at all.
                  </p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <label className="space-y-1 text-xs text-muted-foreground">
                      Role
                      <select
                        className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-foreground"
                        value={project.aiRole || ""}
                        onChange={(event) => updateProject(project.id, { aiRole: event.target.value as AIRole || undefined })}
                      >
                        <option value="">Select</option>
                        {AI_ROLE_OPTIONS.map((option) => (
                          <option key={option.value} className="bg-card" value={option.value}>
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
                  </>
                ) : null}
              </div>
                );
              })}
              {visibleProjects.length === 0 ? <p className="text-sm text-muted-foreground">No projects match this filter yet.</p> : null}
            </div>
          )}
        </CardContent>
        <CardFooter>
          <p className="text-xs text-muted-foreground">
            Every project needs a public link (GitHub repo, demo, notebook) so recruiters can verify the claim.
          </p>
        </CardFooter>
      </Card>

      {filteredRepos.length > 0 && (
        <Card className="border-border bg-card/80">
          <CardHeader>
            <CardTitle className="text-foreground">Imported GitHub repos</CardTitle>
            <CardDescription>Select public repos then add them to your project list.</CardDescription>
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
                  <TableRow key={repo.id} className={cn(selectedRepoIds.has(repo.id) && "bg-card/85")}
                  >
                    <TableCell>
                      <Checkbox checked={selectedRepoIds.has(repo.id)} onCheckedChange={(checked) => toggleRepoSelection(repo.id, Boolean(checked))} />
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-foreground">{repo.fullName}</p>
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
  type: CodeSampleType;
  summary: string;
  authorshipContext: string;
  filePath: string;
  lineStart: string;
  lineEnd: string;
  url: string;
  language: string;
  tags: string;
  code: string;
  readmeHeading?: string;
  commitEntries?: CommitEntry[];
  sourceLocked: boolean;
};

type SampleSelection = {
  type: CodeSampleType;
  filePath?: string;
  language?: string;
  lineStart?: number;
  lineEnd?: number;
  sourceUrl?: string;
  code: string;
  readmeHeading?: string;
  commitEntries?: CommitEntry[];
};

interface CodeSamplePickerProps {
  project: EditableProject;
  initialTab?: "code" | "docs" | "link";
  onClose: () => void;
  onSelect: (selection: SampleSelection) => void;
}

type FilePreviewState = {
  path: string;
  lines: string[];
  ref: string;
};

const createEmptySampleDraft = (): SampleDraft => ({
  type: "code",
  summary: "",
  authorshipContext: "",
  filePath: "",
  lineStart: "",
  lineEnd: "",
  url: "",
  language: "",
  tags: "",
  code: "",
  sourceLocked: false,
});


export function ProjectCodeSamplesEditor({
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
  const [pickerInitialTab, setPickerInitialTab] = useState<"code" | "docs" | "link">("code");
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
        type: sample.type || "code",
        summary: sample.summary || "",
        authorshipContext: sample.authorshipContext || "",
        filePath: sample.filePath || "",
        lineStart: sample.lineStart ? sample.lineStart.toString() : "",
        lineEnd: sample.lineEnd ? sample.lineEnd.toString() : "",
        url: sample.url || projectUrl || "",
        language: sample.language || "",
        tags: (sample.tags || []).join(", "),
        code: sample.code || "",
        readmeHeading: sample.readmeHeading,
        commitEntries: sample.commitEntries,
        sourceLocked: Boolean(sample.sourceLocked),
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
  const openPickerForType = (type: CodeSampleType) => {
    setPickerInitialTab(type === "readme" || type === "commit" ? "docs" : "code");
    setIsPickerOpen(true);
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
    const sampleType: CodeSampleType = draft.type || "code";
    const hasCommitEntries = sampleType === "commit" && Boolean(draft.commitEntries && draft.commitEntries.length > 0);
    if (!summary || (!code && !hasCommitEntries)) {
      toast("Add details", { description: "Summary and evidence content are required." });
      return;
    }
    if (code && code.length > MAX_SAMPLE_CODE_CHARS) {
      toast("Snippet too long", { description: `Limit samples to ${MAX_SAMPLE_CODE_CHARS} characters.` });
      return;
    }
    const enforceLines = sampleType === "code";
    const lineStart = enforceLines && draft.lineStart ? Math.max(1, Number.parseInt(draft.lineStart, 10)) : undefined;
    let lineEnd = enforceLines && draft.lineEnd ? Math.max(1, Number.parseInt(draft.lineEnd, 10)) : undefined;
    if (enforceLines && lineStart && lineEnd && lineEnd < lineStart) {
      lineEnd = lineStart;
    }
    if (enforceLines && lineStart && lineEnd && lineEnd - lineStart > MAX_SAMPLE_LINES) {
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
      type: sampleType,
      summary: summary.slice(0, 200),
      code,
      authorshipContext: draft.authorshipContext.trim() || undefined,
      filePath: draft.filePath.trim() || undefined,
      lineStart,
      lineEnd,
      url: draft.url.trim() || projectUrl,
      language:
        (draft.language || inferLanguage(draft.filePath) || (sampleType === "readme" ? "markdown" : sampleType === "commit" ? "text" : "")).toLowerCase() ||
        undefined,
      tags: normalizedTags,
      readmeHeading: draft.readmeHeading,
      commitEntries: draft.commitEntries?.map((entry) => ({
        sha: entry.sha,
        message: entry.message,
        date: entry.date,
        htmlUrl: entry.htmlUrl,
        patch: entry.patch,
        files: entry.files,
      })),
      sourceLocked: draft.sourceLocked,
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
      type: selection.type || prev.type || "code",
      filePath: selection.filePath || "",
      language: selection.language || prev.language || "",
      lineStart: selection.lineStart ? selection.lineStart.toString() : "",
      lineEnd: selection.lineEnd ? selection.lineEnd.toString() : "",
      url: selection.sourceUrl || projectUrl || "",
      code: selection.code,
      readmeHeading: selection.readmeHeading,
      commitEntries: selection.commitEntries,
      sourceLocked: true,
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
    <div className="space-y-3 rounded-2xl border border-border bg-card/80 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Samples (code, README, commit)</p>
          <p className="text-xs text-muted-foreground">
            Capture short snippets or doc excerpts with commentary. Keep them easy to skim and verify.
          </p>
        </div>
        <div className="flex gap-2">
          {canUsePicker ? (
            <Button type="button" variant="secondary" size="sm" onClick={() => openPickerForType("code")}>
              Select from GitHub
            </Button>
          ) : null}
         
        </div>
      </div>
      {samples.length === 0 ? (
        <p className="text-xs text-muted-foreground">No samples saved yet.</p>
      ) : (
        <div className="space-y-3">
          {samples.map((sample) => (
            <div key={sample.id} className="rounded-2xl border border-border bg-card/85 p-3 text-xs text-muted-foreground">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-foreground line-clamp-2">{sample.summary}</p>
                      <Badge variant="outline" className="border-accent/60 text-[10px] uppercase tracking-wide text-accent">
                        {SAMPLE_TYPE_LABELS[sample.type || "code"]}
                      </Badge>
                    </div>
                    <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
                      {sample.filePath || 'snippet'} {formatLineRange(sample.lineStart, sample.lineEnd)}
                    </p>
                    {sample.authorshipContext ? (
                      <p className="mt-1 text-[11px] text-muted-foreground">What to notice: {sample.authorshipContext}</p>
                    ) : null}
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
          onSelectFromGitHub={canUsePicker ? openPickerForType : undefined}
        />
      ) : null}
      {canUsePicker && isPickerOpen ? (
        <CodeSamplePicker
          project={project}
          initialTab={pickerInitialTab}
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
  onSelectFromGitHub?: (type: CodeSampleType) => void;
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
  const typeCopy = SAMPLE_TYPE_OPTIONS.find((option) => option.value === draft.type);
  const codeLabel = draft.type === "code" ? "Code" : "Excerpt";
  const summaryNudge = getConcreteNudge(draft.summary);
  const codePlaceholder =
    draft.type === "code"
      ? "Paste 10–40 lines of code, tests, or evaluator logic."
      : draft.type === "readme"
        ? "Paste the README paragraph or doc snippet that proves this requirement."
        : "Paste the commit summary or bullet points explaining what changed.";
  const showLineInputs = draft.type === "code";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-border bg-card p-6 text-sm text-muted-foreground shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">{mode === "edit" ? "Edit sample" : "New sample"}</p>
            <h3 className="text-base font-semibold text-foreground">{draft.summary || "Untitled snippet"}</h3>
          </div>
          <button type="button" className="rounded-full border border-border p-2 text-muted-foreground hover:text-foreground" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 space-y-4">
          <div>
            <Label>Sample type: {typeCopy?.label}</Label>
            
            {typeCopy?.helper ? <p className="mt-1 text-[11px] text-muted-foreground">{typeCopy.helper}</p> : null}
          </div>
          <div>
            <div className="flex items-center justify-between gap-2">
              <Label>Summary</Label>
              <Button type="button" variant="ghost" size="sm" onClick={onSuggestSummary} disabled={summaryPending}>
                {summaryPending ? "Polishing…" : "Polish summary"}
              </Button>
            </div>
            <Input value={draft.summary} onChange={onDraftChange("summary")} className="mt-2" placeholder="What does this snippet show?" required />
            {summaryNudge ? <p className="mt-1 text-[11px] text-amber-400">{summaryNudge}</p> : null}
            {summarySuggestion && (
              <div className="mt-2 rounded-xl border border-border bg-card/90 p-3 text-xs text-muted-foreground">
                <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">AI suggestion</p>
                <p className="text-sm text-foreground">{summarySuggestion}</p>
                <p className="mt-2 text-[11px] text-muted-foreground">Copy in the phrasing you like before saving.</p>
              </div>
            )}
          </div>
          <div>
            <Label>What to notice (optional)</Label>
            <Input
              value={draft.authorshipContext}
              onChange={onDraftChange("authorshipContext")}
              className="mt-2"
              maxLength={200}
              placeholder="I wrote X, reviewed Y, integrated Z"
            />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>File path</Label>
              <Input
                value={draft.filePath}
                onChange={onDraftChange("filePath")}
                className={cn("mt-2", draft.sourceLocked && "bg-card/85 text-muted-foreground")}
                placeholder="src/pipelines/features.py"
                readOnly={draft.sourceLocked}
                aria-readonly={draft.sourceLocked}
              />
            </div>
            <div>
              <Label>Language</Label>
              <Input value={draft.language} onChange={onDraftChange("language")} className="mt-2" placeholder="python" />
            </div>
          </div>
          {showLineInputs ? (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Start line</Label>
                  <Input
                    type="number"
                    min={1}
                    value={draft.lineStart}
                    onChange={onDraftChange("lineStart")}
                    className={cn("mt-2", draft.sourceLocked && "bg-card/85 text-muted-foreground")}
                    readOnly={draft.sourceLocked}
                    aria-readonly={draft.sourceLocked}
                  />
                </div>
                <div>
                  <Label>End line</Label>
                  <Input
                    type="number"
                    min={1}
                    value={draft.lineEnd}
                    onChange={onDraftChange("lineEnd")}
                    className={cn("mt-2", draft.sourceLocked && "bg-card/85 text-muted-foreground")}
                    readOnly={draft.sourceLocked}
                    aria-readonly={draft.sourceLocked}
                  />
                </div>
              </div>
              <div>
                <Label>Source URL</Label>
                <Input
                  value={draft.url}
                  onChange={onDraftChange("url")}
                  className={cn("mt-2", draft.sourceLocked && "bg-card/85 text-muted-foreground")}
                  placeholder="https://github.com/demo/file#L1-L20"
                  readOnly={draft.sourceLocked}
                  aria-readonly={draft.sourceLocked}
                />
              </div>
            </div>
          ) : (
            <div>
              <Label>Source URL</Label>
              <Input
                value={draft.url}
                onChange={onDraftChange("url")}
                className={cn("mt-2", draft.sourceLocked && "bg-card/85 text-muted-foreground")}
                placeholder="https://github.com/demo/file#L1-L20"
                readOnly={draft.sourceLocked}
                aria-readonly={draft.sourceLocked}
              />
            </div>
          )}
          {draft.sourceLocked ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-200">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p>Source fields locked because this snippet came directly from GitHub.</p>
                
              </div>
            </div>
          ) : null}
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
              <div className="mt-2 rounded-xl border border-border bg-card/90 p-3 text-xs text-muted-foreground">
                <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Suggested tags</p>
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
            <Label>{codeLabel}</Label>
            <Textarea
              value={draft.code}
              onChange={onDraftChange("code")}
              className={cn(
                "mt-2 text-xs",
                draft.type === "code" ? "font-mono" : "font-sans",
                draft.sourceLocked && "bg-card/85 text-muted-foreground"
              )}
              rows={draft.type === "code" ? 6 : 5}
              placeholder={codePlaceholder}
              required={draft.type !== "commit"}
              readOnly={draft.sourceLocked}
              aria-readonly={draft.sourceLocked}
            />
            {draft.type === "code" ? (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Limit {MAX_SAMPLE_LINES} lines / {MAX_SAMPLE_CODE_CHARS} characters.
              </p>
            ) : draft.type === "commit" ? (
              <p className="mt-1 text-[11px] text-muted-foreground">Commit samples are entry-based. Use selected commits and expandable diffs.</p>
            ) : (
              <p className="mt-1 text-[11px] text-muted-foreground">Keep it concise (under {MAX_SAMPLE_CODE_CHARS} characters) and focused on evidence.</p>
            )}
          </div>
          <div className="flex items-center justify-between gap-2">
            {onSelectFromGitHub ? (
              <Button type="button" variant="secondary" onClick={() => onSelectFromGitHub(draft.type || "code")}>
                Select from GitHub
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

function CodeSamplePicker({ project, initialTab = "code", onClose, onSelect }: CodeSamplePickerProps) {
  const isGitHubProject = project.sourceType !== "link" && Boolean(project.fullName?.includes("/"));
  const defaultBranch = project.defaultBranch || "main";
  const [activeTab, setActiveTab] = useState<"code" | "docs" | "link">(initialTab);
  const [tree, setTree] = useState<RepoTreeItem[]>([]);
  const [treeLoading, setTreeLoading] = useState(false);
  const [treeError, setTreeError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [filePreview, setFilePreview] = useState<FilePreviewState | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null);
  const [lineInputs, setLineInputs] = useState<{ start: string; end: string }>({ start: "", end: "" });
  const [blobUrl, setBlobUrl] = useState("");
  const [blobError, setBlobError] = useState<string | null>(null);
  const [blobLoading, setBlobLoading] = useState(false);
  const [readmeContent, setReadmeContent] = useState<string | null>(null);
  const [readmeLoading, setReadmeLoading] = useState(false);
  const [readmeError, setReadmeError] = useState<string | null>(null);
  const [readmeSelection, setReadmeSelection] = useState<{ start: number; end: number } | null>(null);
  const [commits, setCommits] = useState<RepoCommitSummary[]>([]);
  const [commitsLoading, setCommitsLoading] = useState(false);
  const [commitsError, setCommitsError] = useState<string | null>(null);
  const [selectedCommitShas, setSelectedCommitShas] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    if (isGitHubProject) {
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
    setActiveTab(initialTab);
    setSelectedPath(null);
    setFilePreview(null);
    setSelection(null);
    setFileError(null);
    setBlobError(null);
    setSelectedCommitShas(new Set());
  }, [initialTab]);

  useEffect(() => {
    if (activeTab === "docs" && isGitHubProject) {
      if (!readmeContent && !readmeLoading) {
        void loadReadme();
      }
      if (!commits.length && !commitsLoading) {
        void loadCommits();
      }
    }
  }, [activeTab, isGitHubProject, readmeContent, readmeLoading, commits.length, commitsLoading]);

  const readmeLines = useMemo(() => (readmeContent ? readmeContent.replace(/\r\n/g, "\n").split("\n") : []), [readmeContent]);
  const readmeSelectedLineCount = readmeSelection ? readmeSelection.end - readmeSelection.start + 1 : 0;
  const readmeSelectedCode =
    readmeSelection && readmeLines.length
      ? readmeLines.slice(readmeSelection.start - 1, readmeSelection.end).join("\n")
      : "";
  const readmeSelectionTooLong =
    readmeSelectedLineCount > MAX_SAMPLE_LINES || readmeSelectedCode.length > MAX_SAMPLE_CODE_CHARS;

  const filteredFiles = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return tree
      .filter((entry) => isSnippetEligible(entry))
      .filter((entry) => entry.path.toLowerCase().includes(term))
      .sort((a, b) => a.path.localeCompare(b.path));
  }, [tree, searchTerm]);

  const loadReadme = async () => {
    if (readmeLoading || !isGitHubProject) return;
    setReadmeLoading(true);
    setReadmeError(null);
    setReadmeSelection(null);
    try {
      const data = await fetchRepoReadmeContent(project.fullName);
      setReadmeContent(data.content || "");
    } catch (error) {
      setReadmeError((error as Error).message);
    } finally {
      setReadmeLoading(false);
    }
  };

  const loadCommits = async () => {
    if (commitsLoading || commits.length > 0 || !isGitHubProject) return;
    setCommitsLoading(true);
    setCommitsError(null);
    try {
      const data = await fetchRepoCommitsList(project.fullName, 20);
      setCommits(data);
    } catch (error) {
      setCommitsError((error as Error).message);
    } finally {
      setCommitsLoading(false);
    }
  };

  if (!isGitHubProject) {
    return null;
  }

  const selectedLineCount = selection ? selection.end - selection.start + 1 : 0;
  const selectedCode =
    selection && filePreview
      ? filePreview.lines.slice(selection.start - 1, selection.end).join("\n")
      : "";
  const selectedCharCount = selectedCode.length;
  const selectionTooLong = selectedLineCount > MAX_SAMPLE_LINES || selectedCharCount > MAX_SAMPLE_CODE_CHARS;

  useEffect(() => {
    if (selection) {
      setLineInputs({ start: selection.start.toString(), end: selection.end.toString() });
    } else {
      setLineInputs({ start: "", end: "" });
    }
  }, [selection]);

  const handleFetchFile = async (path: string, refOverride?: string, preset?: { start?: number; end?: number }) => {
    setSelectedPath(path);
    setFileError(null);
    setFileLoading(true);
    setSelection(null);
    setLineInputs({ start: "", end: "" });
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
    const raw = event.target.value;
    setLineInputs((prev) => ({ ...prev, [field]: raw }));
    if (!filePreview) return;
    const value = Number.parseInt(raw, 10);
    if (Number.isNaN(value)) {
      return;
    }
    const clamped = clampLine(value, filePreview.lines.length);
    setSelection((prev) => {
      if (!prev) {
        return { start: clamped, end: clamped };
      }
      if (field === "start") {
        const nextStart = clamped;
        const nextEnd = prev.end !== undefined && prev.end < nextStart ? nextStart : prev.end ?? nextStart;
        return { start: nextStart, end: nextEnd };
      }
      const safeStart = prev.start ?? clamped;
      const nextEnd = clamped < safeStart ? safeStart : clamped;
      return { start: safeStart, end: nextEnd };
    });
  };

  const handleReadmeLineClick = (lineNumber: number) => {
    setReadmeSelection((prev) => {
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

  const handleReadmeLineInputChange = (field: "start" | "end") => (event: ChangeEvent<HTMLInputElement>) => {
    if (!readmeLines.length) return;
    const value = Number.parseInt(event.target.value, 10);
    if (Number.isNaN(value)) {
      setReadmeSelection(null);
      return;
    }
    const clamped = clampLine(value, readmeLines.length);
    setReadmeSelection((prev) => {
      if (!prev) {
        return { start: clamped, end: clamped };
      }
      if (field === "start") {
        const nextStart = clamped;
        const nextEnd = prev.end !== undefined && prev.end < nextStart ? nextStart : prev.end ?? nextStart;
        return { start: nextStart, end: nextEnd };
      }
      const safeStart = prev.start ?? clamped;
      const nextEnd = clamped < safeStart ? safeStart : clamped;
      return { start: safeStart, end: nextEnd };
    });
  };

  const handleUseReadmeSelection = () => {
    if (!readmeLines.length || !readmeSelection) {
      setReadmeError("Load the README and select lines first.");
      return;
    }
    if (readmeSelectionTooLong || readmeSelectedLineCount <= 0) {
      setReadmeError("Selection is empty or too long.");
      return;
    }
    const { start, end } = readmeSelection;
    const trimmed = readmeSelectedCode.trim();
    if (!trimmed) {
      setReadmeError("Selected lines are empty.");
      return;
    }
    const url = buildGitHubBlobUrl(project.fullName, defaultBranch, "README.md", start, end);
    onSelect({
      type: "readme",
      filePath: "README.md",
      language: "markdown",
      lineStart: start,
      lineEnd: end,
      sourceUrl: url,
      code: readmeSelectedCode,
    });
    toast("README snippet captured", { description: `Lines ${start}–${end}` });
  };

  const handleUseSnippet = () => {
    if (!filePreview || !selection || selectionTooLong || selectedLineCount <= 0) return;
    const language = inferLanguage(filePreview.path) || "text";
    const url = buildGitHubBlobUrl(project.fullName, filePreview.ref, filePreview.path, selection.start, selection.end);
    onSelect({
      type: "code",
      filePath: filePreview.path,
      language,
      lineStart: selection.start,
      lineEnd: selection.end,
      sourceUrl: url,
      code: selectedCode,
    });
  };

  const toggleCommitSelection = (sha: string, checked: boolean) => {
    setSelectedCommitShas((prev) => {
      const next = new Set(prev);
      if (checked) next.add(sha);
      else next.delete(sha);
      return next;
    });
  };

  const mapCommitSummaries = (items: RepoCommitSummary[]): CommitEntry[] =>
    items.map((entry) => ({
      sha: entry.sha,
      message: entry.message,
      date: entry.date,
      htmlUrl: entry.htmlUrl,
    }));

  const commitDiffPreview = (detail: RepoCommitDiff) => {
    const patchLines = (detail.patch || "")
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .slice(0, 40)
      .join("\n");
    if (!patchLines) {
      return `diff --git a/${(detail.files[0] || "file")} b/${(detail.files[0] || "file")}\n# Patch not available for this commit`;
    }
    return patchLines;
  };

  const handleUseCommitTrail = async () => {
    const entries = commits.filter((commit) => selectedCommitShas.has(commit.sha));
    if (entries.length < 2) {
      setCommitsError("Select at least two commits to build a trail.");
      return;
    }
    let detailedEntries: CommitEntry[] = mapCommitSummaries(entries);
    let snippet = entries
      .map((entry) => `- ${(entry.message?.split("\n")[0]?.trim() || entry.sha)} (${entry.sha.slice(0, 7)})`)
      .join("\n");

    try {
      const details = await Promise.all(
        entries.slice(0, 3).map(async (entry) => fetchRepoCommitDiff(project.fullName, entry.sha))
      );
      detailedEntries = details.map((detail) => ({
        sha: detail.sha,
        message: detail.message,
        date: detail.date,
        htmlUrl: detail.htmlUrl,
        files: detail.files.slice(0, 3),
        patch: commitDiffPreview(detail),
      }));
      snippet = details
        .map((detail) => {
          const title = detail.message?.split("\n")[0] || detail.sha;
          const header = `# ${title} (${detail.sha.slice(0, 7)})`;
          const patch = commitDiffPreview(detail);
          return `${header}\n${patch}`;
        })
        .join("\n\n")
        .slice(0, MAX_SAMPLE_CODE_CHARS);
    } catch {
      // Keep fallback summary if commit patch fetch fails.
    }
    const sourceUrl = entries[0]?.htmlUrl || project.htmlUrl || `https://github.com/${project.fullName}`;
    onSelect({
      type: "commit",
      filePath: `Commits (${entries.length})`,
      language: "diff",
      code: snippet,
      sourceUrl,
      commitEntries: detailedEntries,
    });
    setSelectedCommitShas(new Set());
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
    setActiveTab("code");
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
          <p className="text-sm font-medium text-foreground">
            {filePreview ? filePreview.path : "Select a file"}
          </p>
          <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">{filePreview ? filePreview.ref : ""}</p>
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
      <div className="h-72 overflow-y-auto rounded-2xl border border-border bg-card/85">
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
                    "flex border-b border-border",
                    isSelected ? "bg-accent/60 text-foreground" : "text-muted-foreground"
                  )}
                >
                  <button
                    type="button"
                    className="w-12 flex-shrink-0 border-r border-border px-2 text-right text-[11px] text-muted-foreground hover:text-foreground"
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
                value={lineInputs.start}
                onChange={handleLineInputChange("start")}
                className="mt-1"
              />
            </label>
            <label className="flex flex-col text-xs text-muted-foreground">
              End line
              <Input
                type="number"
                min={1}
                value={lineInputs.end}
                onChange={handleLineInputChange("end")}
                className="mt-1"
              />
            </label>
            <Button type="button" variant="ghost" size="sm" onClick={() => setSelection(null)}>
              Clear selection
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">
            <p>
              Lines:{" "}
              <span className={selectionTooLong ? "text-red-400" : "text-foreground"}>
                {selectedLineCount} / {MAX_SAMPLE_LINES}
              </span>
            </p>
            <p>
              Characters:{" "}
              <span className={selectedCharCount > MAX_SAMPLE_CODE_CHARS ? "text-red-400" : "text-foreground"}>
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
    setSelectedCommitShas(new Set());
    setReadmeSelection(null);
    onClose();
  };

  const filteredList = activeTab === "code" ? filteredFiles : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6"
      role="dialog"
      aria-modal="true"
      onClick={handleOverlayClick}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-3xl border border-border bg-card shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <p className="text-sm uppercase tracking-[0.4em] text-muted-foreground">Select proof sample</p>
            <p className="text-base font-semibold text-foreground">{project.fullName}</p>
          </div>
          <button
            type="button"
            onClick={handleOverlayClick}
            className="rounded-full border border-border p-2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="border-b border-border px-6 py-3">
          <div className="inline-flex rounded-full border border-border bg-card p-1 text-xs font-medium text-foreground">
            <button
              type="button"
              className={cn(
                "rounded-full px-3 py-1 transition-colors",
                activeTab === "code" ? "bg-accent text-foreground" : "text-muted-foreground"
              )}
              onClick={() => setActiveTab("code")}
            >
              Browse files
            </button>
            <button
              type="button"
              className={cn(
                "rounded-full px-3 py-1 transition-colors",
                activeTab === "docs" ? "bg-accent text-foreground" : "text-muted-foreground"
              )}
              onClick={() => setActiveTab("docs")}
            >
              Docs & commits
            </button>
           
          </div>
        </div>
        <div className="space-y-4 overflow-y-auto px-6 py-4">
          {activeTab === "code" ? (
            <div className="grid gap-4 md:grid-cols-[280px_1fr]">
              <div className="rounded-2xl border border-border bg-card/85 p-3">
                <div className="flex items-center gap-2 rounded-xl border border-border bg-card/85 px-3">
                  <Search className="h-4 w-4 text-muted-foreground" />
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
                                active ? "border-accent/60 bg-accent/10 text-foreground" : "border-border bg-card/80 text-muted-foreground"
                              )}
                            >
                              <p className="font-semibold text-foreground">{file.path.split("/").pop()}</p>
                              <p className="text-[11px] text-muted-foreground">{file.path}</p>
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
          ) : activeTab === "docs" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-border bg-card/85 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">README highlight</p>
                    <p className="text-xs text-muted-foreground">Preview the markdown and capture exact line ranges.</p>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={loadReadme} disabled={readmeLoading}>
                    {readmeLoading ? (
                      <>
                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Loading
                      </>
                    ) : (
                      "Load README"
                    )}
                  </Button>
                </div>
                {readmeError ? <p className="mt-3 text-xs text-red-400">{readmeError}</p> : null}
                {readmeLoading ? (
                  <div className="mt-3 flex h-64 items-center justify-center text-xs text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Fetching README…
                  </div>
                ) : readmeLines.length > 0 ? (
                  <div className="mt-3 space-y-3">
                    <div className="h-64 overflow-y-auto rounded-2xl border border-border bg-card/80">
                      <div className="text-xs font-mono">
                        {readmeLines.map((line, index) => {
                          const lineNumber = index + 1;
                          const isSelected =
                            readmeSelection && lineNumber >= readmeSelection.start && lineNumber <= readmeSelection.end;
                          return (
                            <div
                              key={lineNumber}
                              className={cn(
                                "flex border-b border-border",
                                isSelected ? "bg-accent/60 text-foreground" : "text-muted-foreground"
                              )}
                            >
                              <button
                                type="button"
                                className="w-12 flex-shrink-0 border-r border-border px-2 text-right text-[11px] text-muted-foreground hover:text-foreground"
                                onClick={() => handleReadmeLineClick(lineNumber)}
                              >
                                {lineNumber}
                              </button>
                              <pre className="flex-1 whitespace-pre-wrap px-3 py-1">{line || " "}</pre>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="flex items-center gap-3">
                        <label className="flex flex-col text-xs text-muted-foreground">
                          Start line
                          <Input
                            type="number"
                            min={1}
                            value={readmeSelection?.start ?? ""}
                            onChange={handleReadmeLineInputChange("start")}
                            className="mt-1"
                          />
                        </label>
                        <label className="flex flex-col text-xs text-muted-foreground">
                          End line
                          <Input
                            type="number"
                            min={1}
                            value={readmeSelection?.end ?? ""}
                            onChange={handleReadmeLineInputChange("end")}
                            className="mt-1"
                          />
                        </label>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setReadmeSelection(null)}>
                          Clear
                        </Button>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <p>
                          Lines: {" "}
                          <span className={readmeSelectionTooLong ? "text-red-400" : "text-foreground"}>
                            {readmeSelectedLineCount} / {MAX_SAMPLE_LINES}
                          </span>
                        </p>
                        <p>
                          Characters: {" "}
                          <span className={readmeSelectedCode.length > MAX_SAMPLE_CODE_CHARS ? "text-red-400" : "text-foreground"}>
                            {readmeSelectedCode.length} / {MAX_SAMPLE_CODE_CHARS}
                          </span>
                        </p>
                        {readmeSelectionTooLong ? <p className="text-red-400">Trim the selection.</p> : null}
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 text-xs">
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleUseReadmeSelection}
                        disabled={!readmeSelection || readmeSelectionTooLong || !readmeSelectedLineCount}
                      >
                        Use selected lines
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-muted-foreground">Load the README to capture a documentation excerpt.</p>
                )}
              </div>
              <div className="rounded-2xl border border-border bg-card/85 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Commit trail</p>
                    <p className="text-xs text-muted-foreground">Select 2–5 commits that show progress or debugging.</p>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={loadCommits} disabled={commitsLoading}>
                    Refresh
                  </Button>
                </div>
                <div className="mt-3 flex h-64 flex-col gap-2 overflow-y-auto">
                  {commitsLoading ? (
                    <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading commits…
                    </div>
                  ) : commitsError ? (
                    <p className="text-xs text-red-400">{commitsError}</p>
                  ) : commits.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No recent commits yet.</p>
                  ) : (
                    commits.slice(0, 12).map((commit) => {
                      const preview = commit.message?.split("\n")[0] || "No commit message";
                      const checked = selectedCommitShas.has(commit.sha);
                      return (
                        <label
                          key={commit.sha}
                          className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-card/85 p-3 text-xs text-muted-foreground"
                        >
                          <Checkbox checked={checked} onCheckedChange={(value) => toggleCommitSelection(commit.sha, Boolean(value))} />
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-foreground">{preview}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {commit.sha.slice(0, 7)} · {formatCommitDate(commit.date)}
                            </p>
                            {commit.htmlUrl && (
                              <a
                                href={commit.htmlUrl}
                                target="_blank"
                                rel="noopener noreferrer nofollow"
                                className="text-[11px] text-primary underline"
                              >
                                View on GitHub
                              </a>
                            )}
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
                <Button
                  type="button"
                  className="mt-3 w-full"
                  onClick={handleUseCommitTrail}
                  disabled={commitsLoading || selectedCommitShas.size < 2}
                >
                  Use selected commits
                </Button>
              </div>
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
        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          <div className="text-xs text-muted-foreground">
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

function getProjectProofTypes(project: Pick<Project, "sourceType" | "htmlUrl" | "externalUrl" | "demoUrl">): string[] {
  const labels = new Set<string>();
  const sourceStr = `${project.htmlUrl || ""} ${project.externalUrl || ""}`.toLowerCase();
  const demoStr = (project.demoUrl || "").toLowerCase();

  if (project.sourceType === "github") labels.add("Repo");
  if (sourceStr.includes("/pull/")) labels.add("PR");
  if (sourceStr.includes("/commit/")) labels.add("Commit");
  if (WRITEUP_SITES.some((site) => sourceStr.includes(site))) labels.add("Writeup");
  if (sourceStr.includes("case-study") || sourceStr.includes("casestudy")) labels.add("Case study");
  if (DEMO_SITES.some((site) => demoStr.includes(site))) labels.add("Demo");

  if (labels.size === 0) labels.add("Unapproved Link");
  return Array.from(labels);
}

function findUnsupportedProject(projects: EditableProject[]): EditableProject | null {
  return projects.find((project) => project.sourceType === "link" && getProjectProofTypes(project).includes("Unapproved Link")) || null;
}

function inferLanguage(filePath?: string) {
  return inferLanguageFromPath(filePath);
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

function formatCommitDate(value?: string | null) {
  if (!value) return "Unknown date";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString();
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
