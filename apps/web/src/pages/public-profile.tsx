import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type { Project } from "@evidensify/types";
import { fetchPublicProfile } from "@/lib/api";
import { PublicShareLayout } from "@/components/layout/public-share-layout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useSEO } from "@/lib/seo";

export function PublicProfilePage() {
  const { handle } = useParams();
  const profileQuery = useQuery({
    queryKey: ["public-profile", handle],
    queryFn: () => fetchPublicProfile(handle ?? ""),
    enabled: Boolean(handle),
  });
  const slug = profileQuery.data?.user.profileSlug || handle || "profile";
  useSEO({
    title: `@${slug} public proof profile`,
    description: "Public profile of curated, verifiable technical proof including code, README, and commit evidence.",
    path: `/u/${slug}`,
    type: "profile",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "ProfilePage",
      name: `@${slug} on Evidensify`,
      url:
        typeof window !== "undefined"
          ? `${window.location.origin}/u/${slug}`
          : `https://evidensify.com/u/${slug}`,
      mainEntity: {
        "@type": "Person",
        name: profileQuery.data?.user.githubLogin || slug,
      },
    },
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
                    Curated projects shared via Evidensify. Each link opens a repo, demo, or doc you can verify in seconds.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Candidates pick the evidence themselves, so you’re seeing the exact work they’re proud to stand behind.
                  </p>
                </div>
              </div>
              <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 px-4 py-3 text-xs text-muted-foreground">
                Looking for a job-specific Proof Packet? Ask the candidate for{" "}
                <span className="text-white">/p/&lt;token&gt;</span> so the packet stays unlisted and role-specific.
              </div>
            </div>
          </header>

          <section className="space-y-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Featured proof</p>
              <p className="text-xs text-muted-foreground">Curated highlights only, code, README, and commit proof.</p>
            </div>
            <FeaturedProofSection projects={profileQuery.data.projects} />
          </section>

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
  const highlights = (project.codeSamples || []).filter((sample) => sample.isFeaturedProfile).slice(0, 2);
  const aiUsage = formatAiUsage(project);
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
      {aiUsage ? <p className="text-[11px] text-slate-400">{aiUsage}</p> : null}
      {highlights.length > 0 ? (
        <div className="rounded-xl border border-slate-800/70 bg-slate-950/60 p-3">
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Proof highlights</p>
          <ul className="mt-2 space-y-1">
            {highlights.map((sample) => (
              <li key={sample.id} className="text-xs text-slate-300">
                {sample.summary}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
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

function FeaturedProofSection({ projects }: { projects: Project[] }) {
  const featured = projects.flatMap((project) =>
    (project.codeSamples || [])
      .filter((sample) => sample.isFeaturedProfile)
      .map((sample) => ({ ...sample, projectFullName: project.fullName }))
  );
  const code = featured.filter((sample) => (sample.type || "code") === "code").slice(0, 3);
  const readme = featured.filter((sample) => sample.type === "readme").slice(0, 1);
  const commit = featured.filter((sample) => sample.type === "commit").slice(0, 3);

  if (featured.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-800/80 p-4 text-sm text-muted-foreground">
        No featured proof yet. Ask the candidate to feature their strongest samples.
      </div>
    );
  }

  const renderGroup = (
    title: string,
    items: Array<{ id: string; summary: string; projectFullName: string; filePath?: string; lineStart?: number; lineEnd?: number; type?: string }>
  ) => (
    <div className="space-y-2">
      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{title}</p>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">None featured.</p>
      ) : (
        items.map((sample) => (
          <div key={sample.id} className="rounded-xl border border-slate-900/80 bg-slate-950/70 p-3">
            <p className="text-sm text-white">{sample.summary}</p>
            <p className="mt-1 text-[11px] text-slate-400">{sample.projectFullName}</p>
            <p className="text-[11px] text-slate-500">
              {(sample.filePath || "snippet") + (sample.lineStart && sample.lineEnd ? ` #L${sample.lineStart}-${sample.lineEnd}` : "")}
            </p>
          </div>
        ))
      )}
    </div>
  );

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {renderGroup("Code samples (max 3)", code)}
      {renderGroup("Commit samples (max 3)", commit)}
      {renderGroup("README sample (max 1)", readme)}
    </div>
  );
}

function formatAiUsage(project: Pick<Project, "aiRole" | "aiTools" | "aiSupervisionNotes">): string | null {
  const roleLabels: Record<string, string> = {
    none: "No AI",
    assist: "Assist",
    "co-design": "Co-design",
    "agent-orchestration": "Agent orchestration",
  };
  const parts: string[] = [];
  if (project.aiRole && roleLabels[project.aiRole]) {
    parts.push(`AI usage: ${roleLabels[project.aiRole]}`);
  }
  if (project.aiTools && project.aiTools.length > 0) {
    parts.push(`Tools: ${project.aiTools.join(", ")}`);
  }
  if (project.aiSupervisionNotes) {
    parts.push(`Supervision: ${project.aiSupervisionNotes}`);
  }
  return parts.length ? parts.join(" · ") : null;
}

function ErrorState() {
  return (
    <div className="rounded-2xl border border-slate-900/80 bg-slate-950/80 p-10 text-center text-sm text-muted-foreground">
      Proof profile not available. The candidate may have turned off public access or shared an outdated link.
    </div>
  );
}
