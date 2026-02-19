import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import type { Job } from "@evidensify/types";
import { deleteJob, fetchJobs, updateJobStatus } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { useSession } from "@/hooks/use-session";
import { buildGitHubLoginUrl } from "@/lib/auth";
import { toast } from "sonner";
import { useState } from "react";
import { useSEO } from "@/lib/seo";

const STATUS_LABELS: Record<Job["status"], string> = {
  DRAFT: "Draft",
  PROOF_GENERATED: "Proof ready",
  APPLIED: "Applied",
  INTERVIEW: "Interview",
  REJECTED: "Rejected",
  OFFER: "Offer",
};
const STATUS_OPTIONS: Array<Job["status"]> = ["DRAFT", "PROOF_GENERATED", "APPLIED", "INTERVIEW", "REJECTED", "OFFER"];

export function JobsPage() {
  useSEO({
    title: "Job tracker",
    description: "Track roles, statuses, and job-specific packets in one place.",
    path: "/jobs",
    robots: "noindex,nofollow",
  });
  const queryClient = useQueryClient();
  const [statusTarget, setStatusTarget] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const { data: user, isLoading: sessionLoading } = useSession();
  const isAuthenticated = Boolean(user);
  const { data: jobs, isLoading } = useQuery({ queryKey: ["jobs"], queryFn: fetchJobs, enabled: isAuthenticated });
  const statusMutation = useMutation({
    mutationFn: ({ jobId, status }: { jobId: string; status: Job["status"] }) => updateJobStatus(jobId, status),
    onMutate: ({ jobId }) => setStatusTarget(jobId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["jobs"] });
      toast("Status updated");
    },
    onError: (error: Error) => {
      toast("Update failed", { description: error.message });
    },
    onSettled: () => setStatusTarget(null),
  });
  const deleteMutation = useMutation({
    mutationFn: (jobId: string) => deleteJob(jobId),
    onMutate: (jobId: string) => setDeleteTarget(jobId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["jobs"] });
      toast("Job deleted", { description: "Removed from your tracker and Proof Packets." });
    },
    onError: (error: Error) => {
      toast("Delete failed", { description: error.message });
    },
    onSettled: () => setDeleteTarget(null),
  });

  const handleGitHubLogin = () => {
    window.location.href = buildGitHubLoginUrl("/projects");
  };

  const handleStatusChange = (jobId: string, status: Job["status"]) => {
    statusMutation.mutate({ jobId, status });
  };

  const handleDeleteJob = (jobId: string) => {
    const confirmed = window.confirm("Delete this job? This also removes its Proof Packet.");
    if (!confirmed) return;
    deleteMutation.mutate(jobId);
  };

  if (!sessionLoading && !isAuthenticated) {
    return (
      <Card className="border-border bg-card/80">
        <CardHeader>
          <CardTitle className="text-foreground">Job tracker</CardTitle>
          <CardDescription>Log in to view and track your saved roles.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-dashed border-border p-6 text-center">
            <p className="text-sm text-muted-foreground">Sign in with GitHub to access jobs and Proof Packets.</p>
            <Button className="mt-4" onClick={handleGitHubLogin}>
              Sign in with GitHub
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card/80">
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle className="text-foreground">Job tracker</CardTitle>
          <CardDescription>Track packet status and move faster on follow-up actions.</CardDescription>
        </div>
        <Button asChild>
          <Link to="/jobs/new">
            <Plus className="mr-2 h-4 w-4" /> Create optional job packet
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <div className="mb-4 grid gap-2 md:grid-cols-3">
          <Button asChild variant="outline" className="justify-between">
            <Link to="/projects">Update projects</Link>
          </Button>
          <Button asChild variant="outline" className="justify-between">
            <Link to="/jobs/new">Create optional job packet</Link>
          </Button>
          <Button asChild variant="outline" className="justify-between">
            <Link to="/profile">Public profile</Link>
          </Button>
        </div>
        {isLoading ? (
          <div className="h-32 animate-pulse rounded-xl bg-card/85" />
        ) : jobs && jobs.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell>
                    <div>
                      <p className="font-semibold text-foreground">{job.title}</p>
                      <p className="text-xs text-muted-foreground">{job.company ?? "Unknown company"}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <select
                      className="w-full min-w-[140px] rounded-lg border border-border bg-card/85 px-3 py-1 text-sm text-foreground focus:border-accent focus:outline-none"
                      value={job.status}
                      disabled={statusTarget === job.id && statusMutation.isPending}
                      onChange={(event) => handleStatusChange(job.id, event.target.value as Job["status"])}
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status} className="bg-card text-foreground">
                          {STATUS_LABELS[status]}
                        </option>
                      ))}
                    </select>
                  </TableCell>
                  <TableCell>{new Date(job.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button asChild variant="ghost" size="sm">
                        <Link to={`/jobs/${job.id}`}>View</Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteJob(job.id)}
                        disabled={deleteTarget === job.id && deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Delete job</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">No jobs yet. Start by adding the JD you care about most.</p>
            <Button asChild className="mt-4">
              <Link to="/jobs/new">Add your first job</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
