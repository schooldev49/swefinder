import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import type { Evidence, EvidenceMappingWithEvidence } from "@swefinder/types";
import { fetchSharedPacket } from "@/lib/api";
import { PublicShareLayout } from "@/components/layout/public-share-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export function PublicPacketPage() {
  const { handle, packetSlug } = useParams();
  const packetQuery = useQuery({
    queryKey: ["public-packet", handle, packetSlug],
    queryFn: () => fetchSharedPacket(handle ?? "", packetSlug ?? ""),
    enabled: Boolean(handle && packetSlug),
  });

  return (
    <PublicShareLayout>
      {packetQuery.isLoading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-slate-900/60" />
      ) : packetQuery.isError ? (
        <PacketError />
      ) : packetQuery.data ? (
        <PacketView data={packetQuery.data} />
      ) : null}
    </PublicShareLayout>
  );
}

function PacketView({
  data,
}: {
  data: Awaited<ReturnType<typeof fetchSharedPacket>>;
}) {
  const proof = data.proofPacket;
  const citations = useMemo(() => buildCitationList(proof?.mappings ?? []), [proof?.mappings]);

  return (
    <div className="space-y-6">
      <Card className="border-slate-900/80 bg-slate-950/80">
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14 border border-slate-800">
              <AvatarImage src={data.user.githubAvatarUrl} alt={data.user.githubLogin} />
              <AvatarFallback>{data.user.githubLogin.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-white">{proof?.title ?? `Proof Packet – ${data.job.title}`}</CardTitle>
              <CardDescription>
                @{data.user.profileSlug} → {data.job.title}
                {data.job.company ? ` @ ${data.job.company}` : ""}
              </CardDescription>
              {data.job.jobUrl && (
                <a href={data.job.jobUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">
                  View original JD
                </a>
              )}
            </div>
          </div>
          <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 px-4 py-3 text-xs text-muted-foreground">
            Every bullet and requirement links to verifiable repos or docs supplied by the candidate.
          </div>
        </CardHeader>
      </Card>

      {proof ? (
        <Card className="border-slate-900/80 bg-slate-950/80">
          <CardHeader>
            <CardTitle className="text-white">Proof Packet contents</CardTitle>
            <CardDescription>
              Curated by the candidate for this specific role—every line links to code or docs you can spot-check in under a minute.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <section>
              <SectionHeading title="Key requirements" subtitle="Each mapped to concrete repos or docs." />
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {proof.requirements.map((requirement) => (
                  <RequirementPublicCard
                    key={requirement.id}
                    requirement={requirement}
                    mappings={proof.mappings.filter((mapping) => mapping.requirementId === requirement.id)}
                  />
                ))}
              </div>
            </section>
            <section>
              <SectionHeading title="JD-specific bullets" />
              <ul className="mt-4 space-y-3">
                {proof.bullets.map((bullet, index) => (
                  <li key={index} className="rounded-2xl border border-slate-900/80 bg-slate-950/60 p-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" aria-hidden="true" />
                      <p className="text-sm text-white">{bullet}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <SectionHeading title="Outreach note" />
              <div className="rounded-2xl border border-slate-900/80 bg-slate-950/60 p-4 text-sm text-white">
                {proof.outreachNote}
              </div>
            </section>
            <section>
              <SectionHeading title="Evidence citations" subtitle="Click through to verify code, notebooks, or demos." />
              {citations.length === 0 ? (
                <p className="text-xs text-muted-foreground">No citations available.</p>
              ) : (
                <div className="mt-3 space-y-3">
                  {citations.map((evidence) => (
                    <div key={evidence.id} className="rounded-2xl border border-slate-900/80 bg-slate-950/60 p-4 text-xs text-muted-foreground">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{evidence.projectFullName}</p>
                      {evidence.description && <p className="text-sm text-white">{evidence.description}</p>}
                      {evidence.fileUrl && (
                        <a href={evidence.fileUrl} target="_blank" rel="noopener noreferrer nofollow" className="text-primary underline">
                          View source
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-slate-900/80 bg-slate-950/80">
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Proof Packet not available yet. Ask the candidate to regenerate and resend the link.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function RequirementPublicCard({
  requirement,
  mappings,
}: {
  requirement: NonNullable<Awaited<ReturnType<typeof fetchSharedPacket>>["proofPacket"]>["requirements"][number];
  mappings: EvidenceMappingWithEvidence[];
}) {
  return (
    <div className="rounded-2xl border border-slate-900/80 bg-slate-950/60 p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-white">{requirement.text}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
            Priority {requirement.priority}
          </Badge>
          <span>Evidence: {mappings.length || "0"}</span>
        </div>
      </div>
      <div className="space-y-2">
        {mappings.length === 0 ? (
          <p className="text-xs text-muted-foreground">No direct evidence yet.</p>
        ) : (
          mappings.map((mapping) => (
            <div key={mapping.id} className="rounded-xl border border-slate-900/80 p-3 text-xs text-muted-foreground">
              <p className="font-semibold text-white">{mapping.evidence.projectFullName}</p>
              {mapping.rationale && <p>{mapping.rationale}</p>}
              {mapping.evidence.fileUrl && (
                <a
                  href={mapping.evidence.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="text-primary underline"
                >
                  View proof
                </a>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function buildCitationList(mappings: EvidenceMappingWithEvidence[]): Evidence[] {
  const seen = new Map<string, Evidence>();
  mappings.forEach((mapping) => {
    const key = mapping.evidence.fileUrl || mapping.evidence.repoPath || `${mapping.evidence.projectFullName}-${mapping.evidence.title}`;
    if (key && !seen.has(key)) {
      seen.set(key, mapping.evidence);
    }
  });
  return Array.from(seen.values());
}

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

function PacketError() {
  return (
    <div className="rounded-2xl border border-slate-900/80 bg-slate-950/80 p-10 text-center text-sm text-muted-foreground">
      Proof Packet not found. Double-check the link with the candidate.
    </div>
  );
}
