import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const scopes = [
  { scope: "read:user", usage: "Verify your GitHub identity and avatar" },
  { scope: "user:email", usage: "Populate your contact email for outreach drafts" },
  { scope: "public_repo", usage: "Import repo metadata, READMEs, and commit history for public repos" },
];

export function SecurityPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-10">
      <div>
        <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">Security & access</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">How Evidensify uses GitHub</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          We stick to least-privilege scopes, never push commits, and give you a single place to revoke access or delete imported data.
        </p>
      </div>
      <Card className="border-slate-800/80 bg-slate-950/60">
        <CardHeader>
          <CardTitle className="text-white">GitHub scopes requested</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-200">
          {scopes.map((item) => (
            <div key={item.scope} className="rounded-xl border border-slate-800/60 bg-slate-950/60 px-4 py-3">
              <p className="font-semibold text-white">{item.scope}</p>
              <p className="text-slate-400">{item.usage}</p>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            Need private repos? Enable “Include private repos” during onboarding to grant the <code className="mx-1">repo</code> scope. You can revoke it anytime from GitHub settings.
          </p>
        </CardContent>
      </Card>
      <Card className="border-slate-800/80 bg-slate-950/60">
        <CardHeader>
          <CardTitle className="text-white">Revoke or delete access</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-slate-200">
          <div>
            <p className="font-semibold text-white">Revoke OAuth</p>
            <p className="text-slate-400">
              Visit <a className="text-primary underline" href="https://github.com/settings/connections/applications" target="_blank" rel="noreferrer">GitHub &gt; Settings &gt; Applications</a>, find Evidensify, and click <em>Revoke</em>.
            </p>
          </div>
          <div>
            <p className="font-semibold text-white">Delete imported data</p>
            <p className="text-slate-400">Open Settings → Danger zone in the app and hit “Delete all projects & jobs”. This wipes repos, JDs, and packets from our KV store.</p>
          </div>
          <div>
            <p className="font-semibold text-white">Questions?</p>
            <p className="text-slate-400">Email security@Evidensify.app any time. We publish updates and SOC-style summaries on our changelog.</p>
          </div>
          <Button asChild variant="outline" size="sm" className="text-white">
            <Link to="/onboarding">Back to onboarding</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
