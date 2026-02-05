import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { EvidenceMappingWithEvidence, Job, Project, Requirement } from "@swefinder/types";
import { fetchJob, fetchProjects, generateProof, updateJobStatus } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const STATUS_ORDER: Job["status"][] = ["DRAFT", "PROOF_GENERATED", "APPLIED", "INTERVIEW", "REJECTED", "OFFER"];

export function JobDetailPage() {
  const { id } = useParams();
  const jobId = id ?? "";
  const queryClient = useQueryClient();
  const jobQuery = useQuery({ queryKey: ["job", jobId], queryFn: () => fetchJob(jobId), enabled: Boolean(jobId) });
  const projectsQuery = useQuery({ queryKey: ["projects"], queryFn: fetchProjects });
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (projectsQuery.data) {
      setSelectedProjects(new Set(projectsQuery.data.map((project) => project.id)));
    }
  }, [projectsQuery.data]);

  const job = jobQuery.data?.job;
  const proof = jobQuery.data?.proofPacket;

  const statusMutation = useMutation({
    mutationFn: (status: Job["status"]) => updateJobStatus(jobId, status),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["job", jobId] });
      await queryClient.invalidateQueries({ queryKey: ["jobs"] });
      toast("Status updated");
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: () => generateProof(jobId, { selectedProjectIds: Array.from(selectedProjects) }),
    onSuccess: async (packet) => {
      toast("Proof refreshed", { description: packet.title });
      await queryClient.invalidateQueries({ queryKey: ["job", jobId] });
    },
    onError: (error: Error) => toast("Could not regenerate", { description: error.message }),
  });

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
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline">{job.status}</Badge>
            {nextStatus && (
              <Button size="sm" variant="secondary" onClick={() => statusMutation.mutate(nextStatus)} disabled={statusMutation.isPending}>
                Move to {nextStatus.toLowerCase()}
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
            <CardDescription>Evidence-first summary ready to drop into your application.</CardDescription>
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
          {proof ? (
            <div className="grid gap-6">
              <section>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Key requirements</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {proof.requirements.map((requirement) => (
                    <RequirementCard key={requirement.id} requirement={requirement} mappings={proof.mappings.filter((mapping) => mapping.requirementId === requirement.id)} />
                  ))}
                </div>
              </section>
              <section>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Resume bullets</h3>
                <div className="mt-3 space-y-3">
                  {proof.bullets.map((bullet, index) => (
                    <CopyRow key={index} text={bullet} label={`Bullet ${index + 1}`} />
                  ))}
                </div>
              </section>
              <section>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Outreach note</h3>
                <CopyRow text={proof.outreachNote} label="Outreach" />
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
      <p className="text-xs uppercase tracking-wide text-muted-foreground">Projects in scope</p>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {projects.map((project) => (
          <label key={project.id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-transparent px-3 py-2 hover:border-slate-700">
            <Checkbox checked={selected.has(project.id)} onCheckedChange={(value) => toggleProject(project.id, Boolean(value))} />
            <div>
              <p className="text-sm font-medium text-white">{project.fullName}</p>
              <p className="text-xs text-muted-foreground">{project.description}</p>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}

function RequirementCard({ requirement, mappings }: { requirement: Requirement; mappings: EvidenceMappingWithEvidence[] }) {
  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4">
      <p className="text-sm font-semibold text-white">{requirement.text}</p>
      <p className="text-xs text-muted-foreground">Priority {requirement.priority}</p>
      <div className="mt-3 space-y-2">
        {mappings.length > 0 ? (
          mappings.map((mapping) => (
            <div key={mapping.id} className="rounded-lg border border-slate-800/80 p-3 text-xs text-muted-foreground">
              <p className="font-semibold text-white">{mapping.evidence.projectFullName}</p>
              <p>{mapping.evidence.description}</p>
              {mapping.evidence.fileUrl && (
                <a href={mapping.evidence.fileUrl} target="_blank" rel="noreferrer" className="text-primary underline">
                  Proof link
                </a>
              )}
            </div>
          ))
        ) : (
          <p className="text-xs text-muted-foreground">No mapped evidence yet.</p>
        )}
      </div>
    </div>
  );
}

function CopyRow({ text, label }: { text: string; label: string }) {
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

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4">
      <div className="flex-1 space-y-1">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-sm text-white">{text}</p>
      </div>
      <Button variant="ghost" size="sm" onClick={handleCopy}>
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

function getNextStatus(current: Job["status"]): Job["status"] | null {
  const idx = STATUS_ORDER.indexOf(current);
  if (idx === -1 || idx + 1 >= STATUS_ORDER.length) return null;
  return STATUS_ORDER[idx + 1];
}
