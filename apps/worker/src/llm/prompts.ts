import type { EvidenceMappingWithEvidence, Project, Requirement } from "@evidensify/types";

const HONESTY_PLEDGE = `You are helping a student apply for a specific SWE/CS/ML job in an unbiased way as you will not be penalized for giving negative outcomes. You must NOT invent metrics, numbers, achievements, or artifacts that are not clearly supported by the provided repository metadata or explicit user-provided inputs. If no evidence exists, say so.`;

export function buildRequirementsPrompt(jobDescription: string): string {
  return `SYSTEM:\n${HONESTY_PLEDGE}\n\nTASK:\nRead the job description below and extract 5-10 concrete, technical requirements. Highlight engineering responsibilities, algorithms, tools, data/infra expectations, and measurable outcomes. Ignore perks, logistics, compensation, or generic culture text. Sort by importance. Respond with JSON: [{"id":"string","text":"","priority":number,"notes":"optional"}].\n\nJOB DESCRIPTION:\n${jobDescription}`;
}

export function buildEvidenceMappingPrompt(params: {
  jobDescription: string;
  requirements: Requirement[];
  projects: Project[];
}): string {
  const reqJson = JSON.stringify(params.requirements, null, 2);
  const projectSummaries = params.projects.map((project) => ({
    fullName: project.fullName,
    description: project.description,
    topics: project.topics,
    primaryLanguage: project.primaryLanguage,
    lastUpdated: project.lastUpdated,
    demoUrl: project.demoUrl,
    context: project.context,
    year: project.year,
  }));
  const projectsJson = JSON.stringify(projectSummaries, null, 2);
  return `SYSTEM:\n${HONESTY_PLEDGE}\n\nTASK:\nGiven the technically-focused requirements and project summaries, map each requirement to up to two concrete pieces of engineering evidence. Prioritize code-heavy repos, experiments, system design docs, and metrics tied to software performance. If nothing matches, output {"requirementId":"req","evidence":[]} with reason "no visible evidence". Respond with JSON: [{"requirementId":"","mappings":[{"projectFullName":"","title":"","description":"","links":["repo or demo"],"rationale":"","relevanceScore":0-1}]}].\n\nREQUIREMENTS:\n${reqJson}\n\nPROJECTS:\n${projectsJson}`;
}

export function buildBulletsAndOutreachPrompt(params: {
  requirements: Requirement[];
  mappings: EvidenceMappingWithEvidence[];
}): string {
  const requirementsJson = JSON.stringify(params.requirements, null, 2);
  const mappingSummaries = params.mappings.map((mapping) => ({
    requirementId: mapping.requirementId,
    evidence: mapping.evidence,
    rationale: mapping.rationale,
  }));
  const mappingsJson = JSON.stringify(mappingSummaries, null, 2);
return `SYSTEM:
${HONESTY_PLEDGE}

TASK:
Using the validated requirement-to-evidence links, craft 3–6 plain-text resume bullets and one outreach note that emphasize technical depth—specific stacks, models, infrastructure, experiments, or performance results already present in evidence. Each bullet must cite a specific repo or artifact using the format [repo:<name>] or [artifact:<path>] and must not include invented metrics or claims. If uncertain, use qualitative phrasing instead. The outreach note (3–5 sentences) must reference exactly one artifact and maintain a concise, professional tone. Respond only with valid JSON: {"bullets":[""],"outreachNote":"string","summary":"2-sentence summary emphasizing technical focus and impact"}.

REQUIREMENTS:
${requirementsJson}

EVIDENCE LINKAGE:
${mappingsJson}`;
}

export function buildSnippetSummaryPrompt(params: { summary: string; code: string }): string {
  return `SYSTEM:
${HONESTY_PLEDGE}

TASK:
Rewrite the provided snippet summary into exactly one plain-text sentence (≤180 characters).
Do not add or remove factual details or technologies.
Output the sentence only—no quotes, markdown, or prefixes.
Use natural, clear wording (no jargon or em dashes). Keep deterministic.

CURRENT SUMMARY:
${params.summary}

CODE SNIPPET:
${params.code}`;
}

export function buildSnippetTagsPrompt(params: { summary: string; code: string }): string {
  return `SYSTEM:
${HONESTY_PLEDGE}

TASK:
Suggest up to 3 lowercase tags (≤15 characters) describing the snippet.
Only reference concrete technologies, concepts, or methods present in the summary or code.
Avoid generic tags like "code" or "project".
Respond only with valid JSON: {"tags":["tag1","tag2","tag3"]}.

SUMMARY:
${params.summary}

CODE SNIPPET:
${params.code}`;
}