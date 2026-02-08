import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import type { ApiRepoSummary } from "@/lib/api";
import { fetchGitHubRepos, logout } from "@/lib/api";
import { useSession } from "@/hooks/use-session";
import { buildGitHubLoginUrl } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

const MAX_SELECTION = 5;
const STEP_LABELS = ["Connect GitHub", "Select projects", "Attach proof inputs"];
const CONTEXT_OPTIONS = ["Personal", "Course", "Research", "Startup", "Open Source"];

interface SelectedRepo extends ApiRepoSummary {
  context?: string;
  year?: number;
  summary?: string;
  external?: boolean;
  externalUrl?: string;
  customTitle?: string;
}

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

export function OnboardingPage() {
  const { data: user } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(0);
  const [hasConnected, setHasConnected] = useState(false);
  const [includePrivateRepos, setIncludePrivateRepos] = useState(false);
  const [selectedRepoIds, setSelectedRepoIds] = useState<Set<string>>(new Set());
  const [selectedRepos, setSelectedRepos] = useState<SelectedRepo[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [repoPage, setRepoPage] = useState(1);
  const reposPerPage = 15;
  const [externalForm, setExternalForm] = useState({ title: "", url: "", description: "" });

  const repoQuery = useQuery({
    queryKey: ["onboarding-repos"],
    queryFn: fetchGitHubRepos,
    enabled: hasConnected,
    staleTime: 60 * 1000,
  });

  useEffect(() => {
    setHasConnected(Boolean(user));
  }, [user]);

  const filteredRepos = useMemo(() => {
    if (!repoQuery.data) return [];
    if (!searchTerm) return repoQuery.data;
    return repoQuery.data.filter((repo) => repo.fullName.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [repoQuery.data, searchTerm]);

  const totalRepoPages = Math.max(1, Math.ceil(filteredRepos.length / reposPerPage));
  const safeRepoPage = Math.min(repoPage, totalRepoPages);
  const visibleRepos = useMemo(() => {
    const start = (safeRepoPage - 1) * reposPerPage;
    return filteredRepos.slice(start, start + reposPerPage);
  }, [filteredRepos, safeRepoPage, reposPerPage]);

  useEffect(() => {
    setRepoPage(1);
  }, [searchTerm]);

  const stepStatus = (stepIndex: number) => {
    if (currentStep === stepIndex) return "current";
    if (currentStep > stepIndex) return "done";
    return "upcoming";
  };

  const toggleRepoSelection = (repoId: string, checked: boolean) => {
    setSelectedRepoIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        if (next.size >= MAX_SELECTION) {
          toast.error(`You can only select up to ${MAX_SELECTION} repos at once.`);
          return prev;
        }
        next.add(repoId);
      } else {
        next.delete(repoId);
      }
      return next;
    });
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return hasConnected;
      case 1:
        return selectedRepoIds.size > 0 || selectedRepos.length > 0;
      case 2:
        return selectedRepos.length > 0;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (currentStep === STEP_LABELS.length - 1) {
      navigate("/jobs/new");
      return;
    }
    if (currentStep === 1) {
      const picked = repoQuery.data
        ?.filter((repo) => selectedRepoIds.has(repo.id))
        .slice(0, MAX_SELECTION)
        .map((repo) => {
          const existing = selectedRepos.find((item) => item.id === repo.id);
          if (existing) return existing;
          return {
            ...repo,
            context: "Personal",
            year: repo.updatedAt ? new Date(repo.updatedAt).getFullYear() : undefined,
            summary: "",
          } as SelectedRepo;
        }) ?? [];
      setSelectedRepos(picked);
    }
    setCurrentStep((prev) => Math.min(prev + 1, STEP_LABELS.length - 1));
  };

  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const message = params.get("authError");
    if (message) {
      setAuthError(message);
      params.delete("authError");
      const next = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState({}, "", next.endsWith("?") ? next.slice(0, -1) : next);
    }
  }, []);

  useEffect(() => {
    if (authError) {
      toast.error(authError);
    }
  }, [authError]);

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const handleReconnect = async () => {
    await logout();
    await queryClient.invalidateQueries({ queryKey: ["session"] });
    toast.message("To switch GitHub accounts, log out at github.com first.");
    window.location.href = buildGitHubLoginUrl({
      redirectPath: window.location.pathname,
      includePrivateRepos,
    });
  };

  const handleConnect = () => {
    window.location.href = buildGitHubLoginUrl({
      redirectPath: window.location.pathname,
      includePrivateRepos,
    });
  };

  const addExternalProject = () => {
    if (!externalForm.title || !externalForm.url) {
      toast.error("Title and URL are required");
      return;
    }
    const id = `external-${Date.now()}`;
    setSelectedRepos((prev) => [
      ...prev,
      {
        id,
        name: externalForm.title,
        fullName: externalForm.title,
        description: externalForm.description,
        htmlUrl: externalForm.url,
        topics: [],
        updatedAt: new Date().toISOString(),
        stars: 0,
        fork: false,
        language: "external",
        context: "External",
        summary: externalForm.description,
        external: true,
        externalUrl: externalForm.url,
      },
    ]);
    setExternalForm({ title: "", url: "", description: "" });
    toast("External project added");
  };

  const updateSelectedRepo = (repoId: string, updates: Partial<SelectedRepo>) => {
    setSelectedRepos((prev) => prev.map((repo) => (repo.id === repoId ? { ...repo, ...updates } : repo)));
  };

  const removeSelectedRepo = (repoId: string) => {
    setSelectedRepos((prev) => prev.filter((repo) => repo.id !== repoId));
    setSelectedRepoIds((prev) => {
      const next = new Set(prev);
      next.delete(repoId);
      return next;
    });
  };

  useEffect(() => {
    if (repoQuery.data && repoQuery.data.length && selectedRepoIds.size === 0 && hasConnected) {
      const suggestions = repoQuery.data.slice(0, 3).map((repo) => repo.id);
      setSelectedRepoIds(new Set(suggestions));
    }
  }, [repoQuery.data, selectedRepoIds.size, hasConnected]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 lg:flex-row">
      <aside className="lg:w-64">
        <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">Create a Proof Packet</p>
        <div className="mt-4 space-y-4 text-sm">
          {STEP_LABELS.map((label, index) => (
            <div key={label} className="flex items-center gap-3">
              <div
                className={`h-2 w-2 rounded-full ${
                  stepStatus(index) === "done"
                    ? "bg-accent"
                    : stepStatus(index) === "current"
                      ? "bg-white"
                      : "bg-slate-700"
                }`}
              />
              <span className={stepStatus(index) === "current" ? "text-white" : "text-muted-foreground"}>{label}</span>
            </div>
          ))}
        </div>
        <div className="mt-8 space-y-2 text-xs text-muted-foreground">
          <p>Need help? Email security@Evidensify.app</p>
          <p>
            Want a refresher on access? <Link className="text-primary underline" to="/security">View security & access →</Link>
          </p>
        </div>
      </aside>
      <div className="flex-1 space-y-6">
        {currentStep === 0 && (
          <Card className="border-slate-800/80 bg-slate-950/60">
            <CardHeader>
              <CardTitle className="text-white">Connect GitHub</CardTitle>
              <CardDescription>Turn your repos into evidence recruiters can actually verify.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-slate-200">
              {hasConnected && user ? (
                <>
                  <p className="text-sm text-slate-300">
                    Connected as <span className="font-semibold text-white">{user.githubLogin}</span>. Click “Next” to continue.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Need to switch accounts?{" "}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="px-1 text-primary"
                      onClick={handleReconnect}
                    >
                      Re-auth with GitHub
                    </Button>
                  </p>
                </>
              ) : (
                <>
                  <ul className="space-y-2 text-slate-300">
                    <li>• Read-only access. We never push commits.</li>
                    <li>• You pick which repos to import.</li>
                    <li>• Disconnect or delete data any time.</li>
                  </ul>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button size="lg" onClick={handleConnect}>
                      Sign in with GitHub
                    </Button>
                    <Button variant="outline" size="lg" onClick={() => toast("Email onboarding coming soon.")}>Use email instead</Button>
                  </div>
                  <div className="flex flex-col gap-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Checkbox id="include-private" checked={includePrivateRepos} onCheckedChange={(value) => setIncludePrivateRepos(Boolean(value))} />
                      <label htmlFor="include-private">Include private repos (requires extra GitHub scope)</label>
                    </div>
                    <p>Scopes requested: read:user, user:email, {includePrivateRepos ? "repo" : "public_repo"}. <Link className="text-primary underline" to="/security">View details →</Link></p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {currentStep === 1 && (
          <Card className="border-slate-800/80 bg-slate-950/60">
            <CardHeader>
              <CardTitle className="text-white">Select projects</CardTitle>
              <CardDescription>
                We preselected your three most recently updated repos. Keep up to {MAX_SELECTION} that best prove your skills, then add any missing demos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center gap-2 rounded-xl border border-slate-800/80 bg-slate-900/60 px-3">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search repositories" className="border-0 bg-transparent focus-visible:ring-0" />
              </div>
              {repoQuery.isLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading repos…
                </div>
              )}
              {!repoQuery.isLoading && filteredRepos.length === 0 && (
                <p className="text-sm text-muted-foreground">No repos yet. Connect GitHub or check your permissions.</p>
              )}
              <div className="grid gap-2">
                {visibleRepos.map((repo) => (
                  <label key={repo.id} className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-800/60 bg-slate-950/40 px-3 py-2">
                    <Checkbox checked={selectedRepoIds.has(repo.id)} onCheckedChange={(value) => toggleRepoSelection(repo.id, Boolean(value))} />
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-white">{repo.fullName}</p>
                        {repo.language && (
                          <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                            {repo.language}
                          </Badge>
                        )}
                      </div>
                      {repo.description && <p className="text-xs text-muted-foreground">{repo.description}</p>}
                      <p className="text-[11px] text-muted-foreground">Updated {new Date(repo.updatedAt).toLocaleDateString()}</p>
                    </div>
                  </label>
                ))}
              </div>
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
              <div className="rounded-2xl border border-dashed border-slate-700/70 bg-slate-950/20 p-4">
                <p className="text-sm font-semibold text-white">Add external project</p>
                <p className="text-xs text-muted-foreground">Demo, notebook, or write-up that lives outside GitHub.</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Input placeholder="Title" value={externalForm.title} onChange={(event) => setExternalForm((prev) => ({ ...prev, title: event.target.value }))} />
                  <Input placeholder="URL" value={externalForm.url} onChange={(event) => setExternalForm((prev) => ({ ...prev, url: event.target.value }))} />
                </div>
                <Textarea
                  className="mt-3"
                  rows={2}
                  placeholder="Short description"
                  value={externalForm.description}
                  onChange={(event) => setExternalForm((prev) => ({ ...prev, description: event.target.value }))}
                />
                <Button className="mt-3" variant="outline" size="sm" onClick={addExternalProject}>
                  + Add external project
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Only checked repos and the external items above move forward. You can manage everything later in Projects.</p>
            </CardContent>
          </Card>
        )}

        {currentStep === 2 && (
          <Card className="border-slate-800/80 bg-slate-950/60">
            <CardHeader>
              <CardTitle className="text-white">Attach proof inputs</CardTitle>
              <CardDescription>Give each project context, public links, and a snippet to highlight. We’ll reuse it across Proof Packets.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {selectedRepos.length === 0 && <p className="text-sm text-muted-foreground">No projects selected yet.</p>}
              {selectedRepos.map((repo) => (
                <div key={repo.id} className="space-y-3 rounded-2xl border border-slate-800/80 bg-slate-950/40 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-white">{repo.fullName}</p>
                      <p className="text-[11px] text-muted-foreground">{repo.htmlUrl}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removeSelectedRepo(repo.id)}>
                      Remove
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1 text-xs text-muted-foreground">
                      Context
                      <select
                        className="w-full rounded-xl border border-slate-800/80 bg-slate-950/60 px-3 py-2 text-sm text-white"
                        value={repo.context}
                        onChange={(event) => updateSelectedRepo(repo.id, { context: event.target.value })}
                      >
                        {CONTEXT_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1 text-xs text-muted-foreground">
                      Year
                      <Input
                        type="number"
                        min="2005"
                        max={new Date().getFullYear()}
                        value={repo.year ?? ""}
                        onChange={(event) => updateSelectedRepo(repo.id, { year: Number(event.target.value) })}
                      />
                    </label>
                  </div>
                  <label className="space-y-1 text-xs text-muted-foreground">
                    What did you build?
                    <Textarea
                      value={repo.summary ?? ""}
                      onChange={(event) => updateSelectedRepo(repo.id, { summary: event.target.value })}
                      rows={3}
                      placeholder="Briefly describe the feature, dataset, or impact."
                    />
                  </label>
                  <div className="rounded-xl border border-dashed border-slate-700/70 bg-slate-950/40 p-3 text-xs text-muted-foreground">
                    <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Code samples</p>
                    <p className="mt-1">
                      Use the <span className="text-white">Projects → Add code sample</span> editor to capture a 10–40 line snippet. You’ll be able to “Polish summary” and “Suggest tags” there anytime.
                    </p>
                    <Button asChild size="sm" variant="secondary" className="mt-3 w-full sm:w-auto">
                      <Link to="/projects">Open Projects to add samples</Link>
                    </Button>
                  </div>
                </div>
              ))}
              <div className="rounded-2xl border border-slate-800/80 bg-slate-950/30 p-4">
                <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">Proof checklist</p>
                <ul className="mt-3 space-y-2 text-sm text-slate-200">
                  <li>• At least 1–3 repositories with README/context filled in.</li>
                  <li>• Public URLs for demos or notebooks so reviewers can click.</li>
                  <li>• Add code samples with summaries/tags from the Projects page.</li>
                </ul>
                <p className="mt-3 text-xs text-muted-foreground">When everything feels ready, click “Next” to start your first job-specific Proof Packet.</p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={handleBack} disabled={currentStep === 0}>
            Back
          </Button>
          <Button onClick={handleNext} disabled={!canProceed()}>
            {currentStep === STEP_LABELS.length - 1 ? "Finish" : "Next"}
          </Button>
        </div>
      </div>
    </div>
  );
}
