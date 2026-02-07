import type { EvidenceMappingWithEvidence, Project, Requirement } from "@evidensify/types";

const HONESTY_PLEDGE = `You are helping a student apply for a specific SWE/CS/ML job in an unbiased way as you will not be penalized for giving negative outcomes. You must NOT invent metrics, numbers, achievements, or artifacts that are not clearly supported by the provided repository metadata or explicit user-provided inputs. If no evidence exists, say so.`;

export function buildRequirementsPrompt(jobDescription: string): string {
  return `SYSTEM:\n${HONESTY_PLEDGE}\n\nTASK:\nRead the job description below and extract 5-10 concrete requirements. Sort by importance. Respond with JSON: [{"id":"string","text":"","priority":number,"notes":"optional"}].\n\nJOB DESCRIPTION:\n${jobDescription}`;
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
  return `SYSTEM:\n${HONESTY_PLEDGE}\n\nTASK:\nGiven the requirements and project summaries, map each requirement to up to two concrete pieces of evidence. If nothing matches, output {"requirementId":"req","evidence":[]} with reason "no visible evidence". Respond with JSON: [{"requirementId":"","mappings":[{"projectFullName":"","title":"","description":"","links":["repo or demo"],"rationale":"","relevanceScore":0-1}]}].\n\nREQUIREMENTS:\n${reqJson}\n\nPROJECTS:\n${projectsJson}`;
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
  return `SYSTEM:\n${HONESTY_PLEDGE}\n\nTASK:\nUsing the validated requirement-to-evidence links, craft 3-6 plain-text resume bullets and one outreach note. Each bullet must cite a specific repo or artifact and avoid invented metrics. The outreach note must reference exactly one link. Respond with JSON: {"bullets":[""],"outreachNote":"string","summary":"2 sentence summary"}.\n\nREQUIREMENTS:\n${requirementsJson}\n\nEVIDENCE LINKAGE:\n${mappingsJson}`;
}
