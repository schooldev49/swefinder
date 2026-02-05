import { Link } from "react-router-dom";
import { ArrowRight, Github, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useSession } from "@/hooks/use-session";
import { buildGitHubLoginUrl } from "@/lib/auth";

const steps = [
  { title: "Connect GitHub", body: "Sign in once and securely import the repos that actually prove your skills." },
  { title: "Paste the JD", body: "Drop in any job description and highlight the requirements that matter." },
  { title: "Generate Proof", body: "Get JD-specific bullets, evidence links, and an outreach note tied to real commits." },
];

export function LandingPage() {
  const { data: user } = useSession();

  const primaryCta = user ? (
    <Button asChild size="lg">
      <Link to="/projects">
        Go to dashboard <ArrowRight className="ml-2 h-4 w-4" />
      </Link>
    </Button>
  ) : (
    <Button size="lg" onClick={() => (window.location.href = buildGitHubLoginUrl())}>
      <Github className="mr-2 h-5 w-5" /> Sign in with GitHub
    </Button>
  );

  return (
    <section className="grid gap-10">
      <Card className="bg-gradient-to-br from-slate-900 to-slate-900/60 text-center">
        <CardContent className="space-y-8 py-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-800/80 bg-slate-900/80 px-4 py-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <ShieldCheck className="h-4 w-4" /> Evidence-first job packets
          </div>
          <h1 className="text-4xl font-semibold leading-tight text-white md:text-5xl">
            Turn your GitHub projects into proof employers trust.
          </h1>
          <p className="text-lg text-muted-foreground md:text-xl">
            ProofCraft analyzes your repos, extracts verifiable accomplishments, and assembles ATS-ready bullets that map directly to each job requirement.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 md:flex-row">{primaryCta}</div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {steps.map((step, idx) => (
          <Card key={step.title} className="border-slate-800/80 bg-slate-950/40">
            <CardContent className="space-y-3 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">0{idx + 1}</div>
              <h3 className="text-lg font-semibold text-white">{step.title}</h3>
              <p className="text-sm text-muted-foreground">{step.body}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-slate-800/80 bg-slate-950/40">
        <CardContent className="grid gap-6 p-6 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold text-white">Honesty-first by design</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              No hallucinated metrics, no inflated claims. Every bullet links back to the README, PR, or artifact that proves it.
            </p>
          </div>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-3">
              <Sparkles className="mt-1 h-4 w-4 text-primary" /> Requirements mapped to concrete code references.
            </li>
            <li className="flex items-start gap-3">
              <ShieldCheck className="mt-1 h-4 w-4 text-primary" /> User-provided metrics stay labeled and auditable.
            </li>
          </ul>
        </CardContent>
      </Card>
    </section>
  );
}
