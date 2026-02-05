import { useEffect, useState } from "react";
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
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const CONTEXT_OPTIONS = ["Personal", "Course", "Open Source", "Startup", "Research"];

type EditableProject = ProjectPayload & { draft?: boolean };

export function ProjectsPage() {
  const queryClient = useQueryClient();
  const { data: savedProjects, isLoading } = useQuery({ queryKey: ["projects"], queryFn: fetchProjects });
  const [projects, setProjects] = useState<EditableProject[]>([]);
  const [repos, setRepos] = useState<ApiRepoSummary[]>([]);
  const [selectedRepoIds, setSelectedRepoIds] = useState<Set<string>>(new Set());
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);

  useEffect(() => {
    if (savedProjects) {
      setProjects(savedProjects.map(({ userId, ...rest }) => rest));
    }
  }, [savedProjects]);

  const saveMutation = useMutation({
    mutationFn: (payload: EditableProject[]) => saveProjects(payload),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      setProjects(data.map(({ userId, ...rest }) => rest));
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
      }));
    if (!newEntries.length) {
      toast("Already added", { description: "The selected repos are already in your project list." });
      return;
    }
    setProjects((prev) => [...newEntries, ...prev]);
    setSelectedRepoIds(new Set());
    toast("Projects staged", { description: `${newEntries.length} repo(s) ready to save.` });
  };

  const updateProject = (projectId: string, changes: Partial<EditableProject>) => {
    setProjects((prev) => prev.map((project) => (project.id === projectId ? { ...project, ...changes } : project)));
  };

  const handleSave = () => {
    saveMutation.mutate(projects.map(({ draft, ...payload }) => payload));
  };

  const emptyState = !isLoading && projects.length === 0;

  return (
    <div className="space-y-6">
      <Card className="border-slate-800/80 bg-slate-950/40">
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-white">Saved projects</CardTitle>
            <CardDescription>These repos are the evidence pool for every Proof Packet you generate.</CardDescription>
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={handleImportRepos} disabled={isLoadingRepos}>
              {isLoadingRepos ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Import GitHub repos
            </Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>Save changes</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading && <div className="h-24 animate-pulse rounded-xl bg-slate-900/60" />}
          {emptyState && <p className="text-sm text-muted-foreground">No projects yet. Import a few GitHub repos to get started.</p>}
          <div className="grid gap-4">
            {projects.map((project) => (
              <div key={project.id} className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-white">{project.fullName}</p>
                    <p className="text-xs text-muted-foreground">Updated {new Date(project.lastUpdated).toLocaleDateString()}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
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
              </div>
            ))}
          </div>
        </CardContent>
        <CardFooter>
          <p className="text-xs text-muted-foreground">Every project must map back to a public repo so recruiters can verify the claim.</p>
        </CardFooter>
      </Card>

      {repos.length > 0 && (
        <Card className="border-slate-800/80 bg-slate-950/40">
          <CardHeader>
            <CardTitle className="text-white">Imported GitHub repos</CardTitle>
            <CardDescription>Select repos then add them to your project list.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-end">
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
                {repos.map((repo) => (
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}
