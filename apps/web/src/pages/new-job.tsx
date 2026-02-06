import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type { Project } from "@swefinder/types";
import { createJob, fetchProjects, generateProof } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export function NewJobPage() {
  const { data: projects, isLoading } = useQuery({ queryKey: ["projects"], queryFn: fetchProjects });
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
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
