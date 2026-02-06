/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { EvidenceMappingWithEvidence, Job, Project, Requirement } from "@swefinder/types";
import { fetchJob, fetchProjects, generateProof, updateJobStatus } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, PenSquare, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/hooks/use-session";

const STATUS_ORDER: Job["status"][] = ["DRAFT", "PROOF_GENERATED", "APPLIED", "INTERVIEW", "REJECTED", "OFFER"];

export function JobDetailPage() {
  const { id } = useParams();
  const jobId = id ?? "";
  const queryClient = useQueryClient();
  const { data: session } = useSession();
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
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const shareLink =
    session?.profileSlug && job?.shareSlug ? `${origin}/users/${session.profileSlug}/${job.shareSlug}` : "";

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
            <CardTitle className="text-white">Proof Packet</CardTitle>
            <CardDescription>
              Evidence-first summary you curate before sharing—so startups know you reviewed every proof point yourself.
            </CardDescription>
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
          {job.shareSlug && (
            <ShareLinkCallout shareLink={shareLink} profileSlug={session?.profileSlug} jobSlug={job.shareSlug} />
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
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Resume bullets</h3>
                  <p className="text-xs text-muted-foreground">Plain text, copy-ready lines tailored to this JD.</p>
                </div>
                <div className="mt-3 space-y-3">
                  {proof.bullets.map((bullet, index) => (
                    <CopyRow key={index} text={bullet} label={`Bullet ${index + 1}`} />
                  ))}
                </div>
              </section>
              <section>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Outreach note</h3>
                <p className="text-xs text-muted-foreground">Drop this into LinkedIn or email for tailored outreach.</p>
                <CopyRow text={proof.outreachNote} label="Outreach" />
              </section>
              <section>
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Evidence citations</h3>
                  <p className="text-xs text-muted-foreground">Every claim above links back to a repo file or doc so reviewers can audit it.</p>
                </div>
                {citations.length === 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">No code references yet.</p>
                ) : (
                  <div className="mt-3 space-y-3">
                    {citations.map((evidence) => (
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

function RequirementCard({ requirement, mappings }: { requirement: Requirement; mappings: EvidenceMappingWithEvidence[] }) {
  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-white">{requirement.text}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
              Priority {requirement.priority}
            </Badge>
            <span>Evidence: {mappings.length || "0"} project{mappings.length === 1 ? "" : "s"}</span>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground">
          <PenSquare className="mr-1 h-3.5 w-3.5" /> Edit
        </Button>
      </div>
      <div className="space-y-2">
        {mappings.length > 0 ? (
          mappings.map((mapping) => (
            <div key={mapping.id} className="rounded-lg border border-slate-800/80 p-3 text-xs text-muted-foreground">
              <p className="font-semibold text-white">{mapping.evidence.projectFullName}</p>
              {mapping.evidence.description && <p>{mapping.evidence.description}</p>}
              {mapping.evidence.fileUrl && (
                <a href={mapping.evidence.fileUrl} target="_blank" rel="noreferrer" className="text-accent">
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

function ShareLinkCallout({
  shareLink,
  profileSlug,
  jobSlug,
}: {
  shareLink: string;
  profileSlug?: string;
  jobSlug?: string;
}) {
  const handleCopy = async () => {
    if (!shareLink) return;
    await navigator.clipboard.writeText(shareLink);
    toast("Share link copied", { description: shareLink });
  };
  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Shareable Proof Packet URL</p>
          <p className="font-mono text-sm text-white">
            {profileSlug && jobSlug ? `/users/${profileSlug}/${jobSlug}` : "Set your proof profile handle first"}
          </p>
          <p className="text-xs text-muted-foreground">
            This link always reflects the projects you selected, so reviewers know you curated it for their team.
          </p>
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
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/profile">Profile</Link>
          </Button>
          <Button variant="outline" size="sm" onClick={handleCopy} disabled={!shareLink}>
            Copy link
          </Button>
        </div>
      </div>
    </div>
  );
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
