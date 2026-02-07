import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import type { Job } from "@evidensify/types";
import { fetchJobs } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";
import { useSession } from "@/hooks/use-session";

const STATUS_BADGES: Record<Job["status"], { label: string; variant: "default" | "outline" | "success" | "warning" }> = {
  DRAFT: { label: "Draft", variant: "outline" },
  PROOF_GENERATED: { label: "Proof ready", variant: "success" },
  APPLIED: { label: "Applied", variant: "default" },
  INTERVIEW: { label: "Interview", variant: "success" },
  REJECTED: { label: "Rejected", variant: "outline" },
  OFFER: { label: "Offer", variant: "success" },
};

export function JobsPage() {
  const { data: user, isLoading: sessionLoading } = useSession();
  const isAuthenticated = Boolean(user);
  const { data: jobs, isLoading } = useQuery({ queryKey: ["jobs"], queryFn: fetchJobs, enabled: isAuthenticated });

  if (!sessionLoading && !isAuthenticated) {
    return (
      <Card className="border-slate-800/80 bg-slate-950/40">
        <CardHeader>
          <CardTitle className="text-white">Job tracker</CardTitle>
          <CardDescription>Log in to view and track your saved roles.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-dashed border-slate-800/80 p-6 text-center">
            <p className="text-sm text-muted-foreground">Sign in with GitHub to access jobs and Proof Packets.</p>
            <Button asChild className="mt-4">
              <Link to="/onboarding">Log in to continue</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-800/80 bg-slate-950/40">
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle className="text-white">Job tracker</CardTitle>
          <CardDescription>Every JD, Proof Packet, and status in one view.</CardDescription>
        </div>
        <Button asChild>
          <Link to="/jobs/new">
            <Plus className="mr-2 h-4 w-4" /> New job
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-32 animate-pulse rounded-xl bg-slate-900/60" />
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
                      <p className="font-semibold text-white">{job.title}</p>
                      <p className="text-xs text-muted-foreground">{job.company ?? "Unknown company"}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_BADGES[job.status].variant}>{STATUS_BADGES[job.status].label}</Badge>
                  </TableCell>
                  <TableCell>{new Date(job.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <Link className={cn(buttonVariants({ variant: "ghost", size: "sm" }))} to={`/jobs/${job.id}`}>
                      View
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-800/80 p-8 text-center">
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
