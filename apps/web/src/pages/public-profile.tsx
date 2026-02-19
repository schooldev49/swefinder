import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import type { Project } from "@evidensify/types";
import { fetchPublicProfile } from "@/lib/api";
import { PublicShareLayout } from "@/components/layout/public-share-layout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CodeSnippet } from "@/components/ui/code-snippet";
import { cn } from "@/lib/utils";
import { useSEO } from "@/lib/seo";
import { inferLanguageFromPath } from "@/lib/language";

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
        <div className="h-40 animate-pulse rounded-2xl bg-card/85" />
      ) : profileQuery.isError ? (
        <ErrorState />
      ) : profileQuery.data ? (
        <div className="space-y-8">
          <header className="rounded-3xl border border-border bg-card/95 p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 border border-border">
                  <AvatarImage src={profileQuery.data.user.githubAvatarUrl} alt={profileQuery.data.user.githubLogin} />
                  <AvatarFallback>{profileQuery.data.user.githubLogin.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm uppercase tracking-wide text-muted-foreground">Public profile</p>
                  <h1 className="text-2xl font-semibold text-foreground">@{profileQuery.data.user.profileSlug}</h1>
                  <p className="text-base text-foreground">Skimmable technical proof with linked evidence.</p>
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card/90 px-4 py-3 text-sm text-foreground">
                Connected via GitHub OAuth
              </div>
            </div>
          </header>

          <section className="space-y-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Evidence Snapshots</p>
              <p className="text-sm text-muted-foreground">Code, README, and commit evidence. Expand any card to inspect details.</p>
            </div>
            <FeaturedProofSection projects={profileQuery.data.projects} />
          </section>

          <section className="space-y-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Featured projects</p>
              <p className="text-sm text-muted-foreground">Public sources and concise project context.</p>
            </div>
            {profileQuery.data.projects.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-card/85 p-6 text-sm text-muted-foreground">
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
  const proofTypes = getProjectProofTypes(project);
  return (
    <div className="rounded-2xl border border-border bg-card/90 p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-foreground">{project.fullName}</p>
          {project.description && <p className="text-sm text-foreground">{project.description}</p>}
        </div>
        <Badge variant={project.sourceType === "link" ? "outline" : "default"} className="text-[10px] uppercase tracking-wide">
          {project.sourceType === "link" ? "External" : "GitHub"}
        </Badge>
      </div>
      <div className="flex flex-wrap gap-1">
        {proofTypes.map((type) => (
          <Badge key={type} variant="outline" className="text-[10px] uppercase tracking-wide">
            {type}
          </Badge>
        ))}
        {project.isFork ? (
          <Badge variant="warning" className="text-[10px] uppercase tracking-wide">
            Fork
          </Badge>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
        {project.context && <span>{project.context}</span>}
        {formatProjectYearRange(project) && <span>{formatProjectYearRange(project)}</span>}
        {project.primaryLanguage && <span>{project.primaryLanguage}</span>}
      </div>
      {project.whyItMatters ? <p className="text-sm text-foreground">Why it matters: {project.whyItMatters}</p> : null}
      {aiUsage ? <p className="text-sm text-muted-foreground">{aiUsage}</p> : null}
      {highlights.length > 0 ? (
        <div className="rounded-xl border border-border bg-card/90 p-3">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Proof highlights</p>
          <ul className="mt-2 space-y-1">
            {highlights.map((sample) => (
              <li key={sample.id} className="text-sm text-foreground">
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
          Open proof
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
        <div className="rounded-2xl border border-dashed border-border bg-card/85 p-4 text-sm text-muted-foreground">
          No featured proof yet. Ask the candidate to feature their strongest samples.
        </div>
    );
  }

  const renderGroup = (
    title: string,
    items: Array<{
      id: string;
      summary: string;
      projectFullName: string;
      filePath?: string;
      lineStart?: number;
      lineEnd?: number;
      type?: string;
      language?: string;
      code: string;
      url?: string;
      tags?: string[];
      readmeHeading?: string;
      commitEntries?: Array<{ sha: string; message: string; date?: string | null; htmlUrl?: string; patch?: string; files?: string[] }>;
      sourceCommitSha?: string;
      lastCommitDate?: string | null;
    }>
  ) => (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{title}</p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">None featured.</p>
      ) : (
        items.map((sample) => <FeaturedProofCard key={sample.id} sample={sample} />)
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

function FeaturedProofCard({
  sample,
}: {
  sample: {
    id: string;
    summary: string;
    projectFullName: string;
    filePath?: string;
    lineStart?: number;
    lineEnd?: number;
    type?: string;
    language?: string;
    code: string;
    url?: string;
    tags?: string[];
    readmeHeading?: string;
    commitEntries?: Array<{ sha: string; message: string; date?: string | null; htmlUrl?: string; patch?: string; files?: string[] }>;
    sourceCommitSha?: string;
    lastCommitDate?: string | null;
  };
}) {
  const [open, setOpen] = useState(false);
  const [openCommitSha, setOpenCommitSha] = useState<string | null>(null);
  const isCode = !sample.type || sample.type === "code";
  return (
    <div className="rounded-xl border border-border bg-card/90 p-3">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 text-left"
        onClick={() => setOpen((prev) => !prev)}
      >
        <div>
          <p className="text-sm text-foreground">{sample.summary}</p>
          <p className="mt-1 text-sm text-muted-foreground">{sample.projectFullName}</p>
          <p className="text-sm text-muted-foreground">
            {(sample.filePath || "snippet") + (sample.lineStart && sample.lineEnd ? ` #L${sample.lineStart}-${sample.lineEnd}` : "")}
          </p>
        </div>
        <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", open ? "rotate-90" : "")} />
      </button>
      {sample.type === "commit" && sample.commitEntries && sample.commitEntries.length > 0 ? (
        <div className="mt-2 rounded-md border border-border bg-card/90 p-2 text-sm text-foreground">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Commit titles</p>
          <ul className="mt-1 space-y-1">
            {sample.commitEntries.slice(0, 3).map((entry) => (
              <li key={`${sample.id}-${entry.sha}`} className="truncate">
                {entry.message.split("\n")[0]}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {sample.tags && sample.tags.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {sample.tags.map((tag) => (
            <Badge key={`${sample.id}-${tag}`} variant="outline" className="text-[10px]">
              {tag}
            </Badge>
          ))}
        </div>
      ) : null}
      {open ? (
        <div className="mt-3 space-y-2">
          {sample.type === "commit" && sample.commitEntries && sample.commitEntries.length > 0 ? (
            <div className="rounded-lg border border-border bg-card/80 p-2 text-[11px] text-muted-foreground">
              <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Commit trail</p>
              <div className="mt-1 space-y-2">
                {sample.commitEntries.slice(0, 5).map((entry) => {
                  const title = entry.message.split("\n")[0];
                  const isOpen = openCommitSha === entry.sha;
                  return (
                    <div key={entry.sha} className="rounded-md border border-border bg-card/80 p-2">
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => setOpenCommitSha((prev) => (prev === entry.sha ? null : entry.sha))}
                          className="truncate text-left text-foreground"
                        >
                          {title}
                        </button>
                        {entry.htmlUrl ? (
                          <a href={entry.htmlUrl} target="_blank" rel="noopener noreferrer nofollow" className="font-mono text-[10px] text-primary underline">
                            #{entry.sha.slice(0, 7)}
                          </a>
                        ) : (
                          <span className="font-mono text-[10px] text-muted-foreground">#{entry.sha.slice(0, 7)}</span>
                        )}
                      </div>
                      {isOpen && entry.patch ? (
                        <div className="mt-2">
                          <CodeSnippet code={limitDiffLines(entry.patch, 40)} language="diff" />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
          {sample.lastCommitDate ? <p className="text-[11px] text-muted-foreground">Updated {formatDate(sample.lastCommitDate)}</p> : null}
          {sample.sourceCommitSha ? <p className="text-[11px] font-mono text-muted-foreground">Snapshot #{sample.sourceCommitSha.slice(0, 7)}</p> : null}
          {isCode ? (
            <CodeSnippet code={sample.code} language={sample.language || inferLanguage(sample.filePath) || "tsx"} />
          ) : sample.type === "commit" ? (
            sample.commitEntries && sample.commitEntries.length > 0 ? (
              <p className="text-[11px] text-muted-foreground">Select a commit above to preview the diff.</p>
            ) : sample.code ? (
              <CodeSnippet code={limitDiffLines(sample.code, 40)} language="diff" />
            ) : (
              <p className="text-[11px] text-muted-foreground">No commit diff available for this sample.</p>
            )
          ) : (
            <CodeSnippet code={sample.code} language={sample.language || inferLanguage(sample.filePath) || "markdown"} />
          )}
          {sample.readmeHeading ? <p className="text-[11px] text-muted-foreground">README section: {sample.readmeHeading}</p> : null}
          {sample.url ? (
            <Button asChild variant="outline" size="sm">
              <a href={sample.url} target="_blank" rel="noopener noreferrer nofollow">
                Open source
              </a>
            </Button>
          ) : null}
        </div>
      ) : (
      <p className="mt-2 text-sm text-muted-foreground">Collapsed for quick scan.</p>
      )}
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

function inferLanguage(filePath?: string) {
  return inferLanguageFromPath(filePath);
}

function limitDiffLines(diff: string, maxLines: number): string {
  const lines = diff.split("\n");
  if (lines.length <= maxLines) return diff;
  return `${lines.slice(0, maxLines).join("\n")}\n...`;
}

function formatDate(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatProjectYearRange(project: Pick<Project, "year" | "yearStart" | "yearEnd" | "yearPresent">): string {
  const currentYear = new Date().getFullYear();
  if (project.yearStart) {
    if (project.yearPresent) {
      return project.yearStart === currentYear ? String(currentYear) : `${project.yearStart} - Present`;
    }
    if (project.yearEnd && project.yearEnd !== project.yearStart) {
      return `${project.yearStart} - ${project.yearEnd}`;
    }
    return String(project.yearStart);
  }
  return project.year ? String(project.year) : "";
}

function getProjectProofTypes(project: Project): string[] {
  const labels = new Set<string>();
  
  // Normalize all possible signal sources
  const sourceStr = `${project.htmlUrl || ''} ${project.externalUrl || ''}`.toLowerCase();
  const demoStr = (project.demoUrl || "").toLowerCase();

  // 1. Explicit Type Checks
  if (project.sourceType === "github") labels.add("Repo");

  // 2. Pattern Matching for Source
  if (sourceStr.includes("/pull/")) labels.add("PR");
  if (sourceStr.includes("/commit/")) labels.add("Commit");
  
  const writeupSites = ["notion.so", "medium.com", "docs.google.com", "substack.com", "mirror.xyz"];
  if (writeupSites.some(site => sourceStr.includes(site))) {
    labels.add("Writeup");
  }

  if (sourceStr.includes("case-study") || sourceStr.includes("casestudy")) {
    labels.add("Case study");
  }

  // 3. Demo Checks
  const demoSites = ["youtube.com", "codesandbox.io", "figma.com","youtu.be", "loom.com", "streamlit", "vercel.app", "netlify.app", "azurewebsites"];
  if (demoSites.some(site => demoStr.includes(site))) {
    labels.add("Demo");
  }

  // 4. Fallback Logic
  // Only auto-label as 'Case study' if it's explicitly marked as a 'link' type
  if (project.sourceType === "link" && labels.size === 0) {
    labels.add("Case study");
  }

  // 5. Final Safety Net: Unapproved Detection
  // If after all checks the set is still empty, mark it for review
  if (labels.size === 0) {
    labels.add("Unapproved Link");
  }

  return Array.from(labels);
}

function ErrorState() {
  return (
    <div className="rounded-2xl border border-border bg-card/95 p-10 text-center text-sm text-muted-foreground">
      Proof profile not available. The candidate may have turned off public access or shared an outdated link.
    </div>
  );
}
