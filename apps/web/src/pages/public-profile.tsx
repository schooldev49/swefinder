import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type { Project } from "@swefinder/types";
import { fetchPublicProfile } from "@/lib/api";
import { PublicShareLayout } from "@/components/layout/public-share-layout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export function PublicProfilePage() {
  const { handle } = useParams();
  const profileQuery = useQuery({
    queryKey: ["public-profile", handle],
    queryFn: () => fetchPublicProfile(handle ?? ""),
    enabled: Boolean(handle),
  });

  return (
    <PublicShareLayout>
      {profileQuery.isLoading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-slate-900/60" />
      ) : profileQuery.isError ? (
        <ErrorState />
      ) : profileQuery.data ? (
        <div className="space-y-8">
          <header className="rounded-3xl border border-slate-900/80 bg-slate-950/80 p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 border border-slate-800">
                  <AvatarImage src={profileQuery.data.user.githubAvatarUrl} alt={profileQuery.data.user.githubLogin} />
                  <AvatarFallback>{profileQuery.data.user.githubLogin.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm uppercase tracking-wide text-muted-foreground">Proof profile</p>
                  <h1 className="text-2xl font-semibold text-white">@{profileQuery.data.user.profileSlug}</h1>
                  <p className="text-sm text-muted-foreground">
                    Curated projects shared via ProofCraft. Each link opens a repo, demo, or doc you can verify in seconds.
                  </p>
                </div>
              </div>
              <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 px-4 py-3 text-xs text-muted-foreground">
                Looking for a job-specific Proof Packet? Ask the candidate for{" "}
                <span className="text-white">/users/{profileQuery.data.user.profileSlug}/&lt;job&gt;</span>.
              </div>
            </div>
          </header>

          <section className="space-y-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Showcased projects</p>
              <p className="text-xs text-muted-foreground">Each project links to verifiable code or artifacts.</p>
            </div>
            {profileQuery.data.projects.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-800/80 p-6 text-sm text-muted-foreground">
                The candidate hasn’t showcased any projects publicly yet.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {profileQuery.data.projects.map((project) => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>
            )}
          </section>
        </div>
      ) : null}
    </PublicShareLayout>
  );
}

function ProjectCard({ project }: { project: Project }) {
  return (
    <div className="rounded-2xl border border-slate-900/80 bg-slate-950/80 p-5 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-white">{project.fullName}</p>
          {project.description && <p className="text-sm text-muted-foreground">{project.description}</p>}
        </div>
        <Badge variant={project.sourceType === "link" ? "outline" : "default"} className="text-[10px] uppercase tracking-wide">
          {project.sourceType === "link" ? "Link" : "GitHub"}
        </Badge>
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {project.context && <span>{project.context}</span>}
        {project.year && <span>{project.year}</span>}
        {project.primaryLanguage && <span>{project.primaryLanguage}</span>}
      </div>
      {project.htmlUrl && (
        <a
          href={project.htmlUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="inline-flex items-center text-sm text-primary underline"
        >
          View source
        </a>
      )}
      {project.demoUrl && project.demoUrl !== project.htmlUrl && (
        <a
          href={project.demoUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="inline-flex items-center text-xs text-muted-foreground underline"
        >
          Demo / doc
        </a>
      )}
    </div>
  );
}

function ErrorState() {
  return (
    <div className="rounded-2xl border border-slate-900/80 bg-slate-950/80 p-10 text-center text-sm text-muted-foreground">
      Proof profile not available. The candidate may have turned off public access or shared an outdated link.
    </div>
  );
}
