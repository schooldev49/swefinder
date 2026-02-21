import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useSEO } from "@/lib/seo";

const scopes = [
  { scope: "read:user", usage: "Verify your GitHub identity and avatar" },
  { scope: "public_repo", usage: "Import repo metadata, READMEs, and commit history for public repos" },
];

export function SecurityPage() {
  useSEO({
    title: "Security and GitHub access",
    description: "Learn how Evidensify handles GitHub scopes, access revocation, and data deletion.",
    path: "/security",
  });
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-10">
      <div>
        <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">Security & access</p>
        <h1 className="mt-2 text-3xl font-semibold text-foreground">How Evidensify uses GitHub</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          We stick to least-privilege scopes, never push commits, and give you a single place to revoke access or delete imported data.
        </p>
      </div>
      <Card className="border-border bg-card/85">
        <CardHeader>
          <CardTitle className="text-foreground">GitHub scopes requested</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-foreground">
          {scopes.map((item) => (
            <div key={item.scope} className="rounded-xl border border-border bg-card/85 px-4 py-3">
              <p className="font-semibold text-foreground">{item.scope}</p>
              <p className="text-muted-foreground">{item.usage}</p>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">Only public repositories and public links are supported in Proof Packets.</p>
        </CardContent>
      </Card>
      <Card className="border-border bg-card/85">
        <CardHeader>
          <CardTitle className="text-foreground">Revoke or delete access</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-foreground">
          <div>
            <p className="font-semibold text-foreground">Revoke OAuth</p>
            <p className="text-muted-foreground">
              Visit <a className="text-primary underline" href="https://github.com/settings/connections/applications" target="_blank" rel="noreferrer">GitHub &gt; Settings &gt; Applications</a>, find Evidensify, and click <em>Revoke</em>.
            </p>
          </div>
          <div>
            <p className="font-semibold text-foreground">Delete imported data</p>
            <p className="text-muted-foreground">Open Settings → Danger zone in the app and hit “Delete all projects & jobs”. This wipes repos, JDs, and packets from our KV store.</p>
          </div>
          <div>
            <p className="font-semibold text-foreground">Questions?</p>
            <p className="text-muted-foreground">Email security@evidensify.com any time. We publish updates and SOC-style summaries on our changelog.</p>
          </div>
          <Button asChild variant="outline" size="sm" className="text-foreground">
            <Link to="/projects">Back to projects</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
