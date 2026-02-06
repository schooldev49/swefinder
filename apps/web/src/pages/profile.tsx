/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import type { Job } from "@swefinder/types";
import { fetchJobs, fetchProfile, updateProfile } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const STATUS_DISPLAY: Record<Job["status"], { label: string; variant: "default" | "outline" | "success" | "warning" }> = {
  DRAFT: { label: "Draft", variant: "outline" },
  PROOF_GENERATED: { label: "Proof ready", variant: "success" },
  APPLIED: { label: "Applied", variant: "default" },
  INTERVIEW: { label: "Interview", variant: "success" },
  REJECTED: { label: "Rejected", variant: "outline" },
  OFFER: { label: "Offer", variant: "success" },
};

export function ProfilePage() {
  const queryClient = useQueryClient();
  const profileQuery = useQuery({ queryKey: ["profile"], queryFn: fetchProfile });
  const jobsQuery = useQuery({ queryKey: ["jobs"], queryFn: fetchJobs });
  const [slug, setSlug] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  useEffect(() => {
    if (profileQuery.data?.user) {
      setSlug(profileQuery.data.user.profileSlug ?? "");
      setIsPublic(Boolean(profileQuery.data.user.profilePublic));
    }
  }, [profileQuery.data?.user]);

  const saveMutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: async () => {
      toast("Profile updated", { description: "Your proof links now use the latest slug + visibility." });
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (error: Error) => toast("Could not update profile", { description: error.message }),
  });

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const trimmedSlug = slug.trim().toLowerCase();
  const profileUrl = trimmedSlug ? `${origin}/users/${trimmedSlug}` : "";
  const initialSlug = profileQuery.data?.user.profileSlug ?? "";
  const initialPublic = Boolean(profileQuery.data?.user.profilePublic);
  const hasChanges = trimmedSlug !== initialSlug || isPublic !== initialPublic;
  const slugTooShort = trimmedSlug.length > 0 && trimmedSlug.length < 3;

  const shareableJobs = useMemo(
    () => (jobsQuery.data || []).filter((job) => Boolean(job.shareSlug && job.proofPacketId)),
    [jobsQuery.data]
  );

  const handleSave = () => {
    if (!trimmedSlug) {
      toast("Add a public handle first");
      return;
    }
    saveMutation.mutate({ profileSlug: trimmedSlug, profilePublic: isPublic });
  };

  const copyLink = async (value: string, label: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast(`${label} copied`, { description: value });
    } catch (error) {
      toast("Unable to copy link", { description: (error as Error).message });
    }
  };

  return (
    <div className="grid gap-6">
      <Card className="border-slate-800/80 bg-slate-950/40">
        <CardHeader>
          <CardTitle className="text-white">Proof profile</CardTitle>
          <CardDescription>Pick a handle, decide visibility, and share a link that shows you curated the proof yourself.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="profile-slug">Public handle</Label>
            <Input
              id="profile-slug"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              placeholder="e.g. demo-student"
              className="max-w-md"
            />
            <p className="text-xs text-muted-foreground">
              Your profile lives at <span className="text-white/80">/users/{trimmedSlug || "<handle>"}</span>
            </p>
            {slugTooShort && <p className="text-xs text-red-400">Handle must be at least 3 characters.</p>}
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-slate-800/80 bg-slate-950/60 p-4">
            <Checkbox
              id="profile-public"
              checked={isPublic}
              onCheckedChange={(checked) => setIsPublic(Boolean(checked))}
              className="mt-1"
            />
            <div className="space-y-1">
              <Label htmlFor="profile-public" className="font-medium text-white">
                Make profile discoverable
              </Label>
              <p className="text-sm text-muted-foreground">
                When enabled, anyone can view your showcased projects at {profileUrl || "your proof URL"}.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              {hasChanges ? "Unsaved changes" : "Profile is synced with your latest settings."}
            </div>
            <Button
              onClick={handleSave}
              disabled={!hasChanges || !trimmedSlug || slugTooShort || saveMutation.isPending}
            >
              {saveMutation.isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-800/80 bg-slate-950/40">
        <CardHeader>
          <CardTitle className="text-white">Shareable links</CardTitle>
          <CardDescription>
            Give recruiters a single profile URL, or share job-specific Proof Packets that highlight the work you selected for that team.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-medium text-white">Proof profile</p>
                <p className="text-xs text-muted-foreground">
                  This is the reusable link for /users/{trimmedSlug || "handle"}.
                </p>
                {!isPublic && (
                  <p className="text-xs text-amber-400">Enable “Make profile discoverable” to share this publicly.</p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {profileUrl ? (
                  <a
                    href={profileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center text-sm text-primary underline"
                  >
                    <ExternalLink className="mr-1 h-3.5 w-3.5" /> Preview
                  </a>
                ) : null}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyLink(profileUrl, "Profile link")}
                  disabled={!profileUrl}
                >
                  <Copy className="mr-2 h-4 w-4" /> Copy link
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Job-specific Proof Packets
                </p>
                <p className="text-xs text-muted-foreground">
                  Each link is scoped to one job: /users/{trimmedSlug || "handle"}/&lt;job-slug&gt;
                </p>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/jobs">Go to jobs</Link>
              </Button>
            </div>
            {shareableJobs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-800/80 p-6 text-sm text-muted-foreground">
                Generate a Proof Packet to unlock share links for a job. You’ll see them here immediately.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Share link</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shareableJobs.map((job) => {
                    const link = profileUrl && job.shareSlug ? `${profileUrl}/${job.shareSlug}` : "";
                    return (
                      <TableRow key={job.id}>
                        <TableCell>
                          <div>
                            <p className="font-semibold text-white">{job.title}</p>
                            <p className="text-xs text-muted-foreground">{job.company ?? "Unknown company"}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={STATUS_DISPLAY[job.status].variant}>{STATUS_DISPLAY[job.status].label}</Badge>
                        </TableCell>
                        <TableCell>
                          {link ? (
                            <code className="text-xs text-primary">{`/users/${trimmedSlug}/${job.shareSlug}`}</code>
                          ) : (
                            <span className="text-xs text-muted-foreground">Set your profile handle first</span>
                          )}
                        </TableCell>
                        <TableCell className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyLink(link, `${job.title} packet`)}
                            disabled={!link}
                          >
                            <Copy className="mr-2 h-4 w-4" /> Copy
                          </Button>
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={`/jobs/${job.id}`}>Open</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
