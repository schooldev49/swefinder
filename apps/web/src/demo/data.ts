import type { EvidenceMappingWithEvidence, Job, Project, ProofPacket, Requirement, User } from "@swefinder/types";
import type { ApiRepoSummary } from "@/lib/api";

export const demoUser: User = {
  id: "user-demo",
  githubId: 42,
  githubLogin: "demo-student",
  githubAvatarUrl: "https://avatars.githubusercontent.com/u/9919?v=4",
  createdAt: new Date("2024-09-01T12:00:00Z").toISOString(),
};

export const demoRepos: ApiRepoSummary[] = [
  {
    id: "1",
    name: "ml-research-notebooks",
    fullName: "demo-student/ml-research-notebooks",
    description: "Transformer-based toxicity classifier with Weights & Biases reports.",
    htmlUrl: "https://github.com/demo-student/ml-research-notebooks",
    language: "Python",
    topics: ["pytorch", "transformers", "ml"],
    updatedAt: new Date("2025-01-10").toISOString(),
    stars: 42,
    fork: false,
  },
  {
    id: "2",
    name: "realtime-collab-board",
    fullName: "demo-student/realtime-collab-board",
    description: "WebRTC whiteboard with CRDT sync",
    htmlUrl: "https://github.com/demo-student/realtime-collab-board",
    language: "TypeScript",
    topics: ["webrtc", "crdt", "react"],
    updatedAt: new Date("2024-12-15").toISOString(),
    stars: 67,
    fork: false,
  },
  {
    id: "3",
    name: "data-pipeline-kit",
    fullName: "demo-student/data-pipeline-kit",
    description: "Rust + Python toolkit for ingesting telemetry",
    htmlUrl: "https://github.com/demo-student/data-pipeline-kit",
    language: "Rust",
    topics: ["rust", "cli", "data"],
    updatedAt: new Date("2024-11-02").toISOString(),
    stars: 31,
    fork: false,
  },
];

export const demoProjects: Project[] = [
  {
    id: "project-ml",
    userId: demoUser.id,
    sourceType: "github",
    fullName: demoRepos[0].fullName,
    htmlUrl: demoRepos[0].htmlUrl,
    description: demoRepos[0].description,
    primaryLanguage: demoRepos[0].language,
    topics: demoRepos[0].topics,
    lastUpdated: demoRepos[0].updatedAt,
    context: "Research",
    year: 2025,
    demoUrl: "https://huggingface.co/spaces/demo-student/toxicity",
    createdAt: demoRepos[0].updatedAt,
    updatedAt: demoRepos[0].updatedAt,
  },
  {
    id: "project-webrtc",
    userId: demoUser.id,
    sourceType: "github",
    fullName: demoRepos[1].fullName,
    htmlUrl: demoRepos[1].htmlUrl,
    description: demoRepos[1].description,
    primaryLanguage: demoRepos[1].language,
    topics: demoRepos[1].topics,
    lastUpdated: demoRepos[1].updatedAt,
    context: "Hackathon",
    year: 2024,
    demoUrl: "https://demo-student.github.io/realtime-collab-board",
    createdAt: demoRepos[1].updatedAt,
    updatedAt: demoRepos[1].updatedAt,
  },
  {
    id: "project-external",
    userId: demoUser.id,
    sourceType: "link",
    fullName: "Autonomous drone telemetry write-up",
    htmlUrl: "https://demo-student.notion.site/autonomous-drone-proof",
    externalUrl: "https://demo-student.notion.site/autonomous-drone-proof",
    description: "Notion doc breaking down how I tuned PID loops and processed 2M telemetry rows.",
    topics: ["notebook", "analysis"],
    lastUpdated: new Date("2024-10-05").toISOString(),
    context: "Personal",
    year: 2024,
    demoUrl: "https://demo-student.notion.site/autonomous-drone-proof",
    createdAt: new Date("2024-10-05").toISOString(),
    updatedAt: new Date("2024-10-05").toISOString(),
  },
];

const requirements: Requirement[] = [
  {
    id: "req-ml",
    jobId: "job-demo",
    text: "Design ML experiments and communicate findings",
    priority: 1,
  },
  {
    id: "req-realtime",
    jobId: "job-demo",
    text: "Ship production-ready real-time UIs",
    priority: 2,
  },
];

function mapping(project: Project, requirementId: string): EvidenceMappingWithEvidence {
  return {
    id: `${requirementId}-${project.id}`,
    requirementId,
    evidenceId: `${project.id}-evidence`,
    relevanceScore: 0.92,
    rationale: `Directly addresses ${requirementId}`,
    evidence: {
      id: `${project.id}-ev`,
      projectId: project.id,
      projectFullName: project.fullName,
      title: project.fullName,
      description: project.description,
      fileUrl: project.htmlUrl,
      demoUrl: project.demoUrl,
      context: project.context,
      year: project.year,
    },
  };
}

export const demoJob: Job = {
  id: "job-demo",
  userId: demoUser.id,
  title: "ML Research Intern",
  company: "Nova Robotics",
  jobUrl: "https://novarobotics.ai/internships",
  rawDescription:
    "Nova Robotics is hiring an ML Research Intern to prototype classification models, partner with design on real-time collaboration tools, and ship experiments quickly.",
  status: "PROOF_GENERATED",
  createdAt: new Date("2025-01-15T09:00:00Z").toISOString(),
  proofPacketId: "proof-demo",
};

export const demoProof: ProofPacket = {
  id: "proof-demo",
  jobId: demoJob.id,
  title: "Proof Packet – ML Research Intern @ Nova Robotics",
  summary: "Paired HuggingFace-based toxicity classifier results with a CRDT-enabled collaboration surface to mirror Nova's evaluation workflow.",
  requirements,
  mappings: [mapping(demoProjects[0], "req-ml"), mapping(demoProjects[1], "req-realtime")],
  bullets: [
    "Fine-tuned a RoBERTa toxicity classifier on 1.2M comments with HF Accelerate, delivering 94% F1 tracked in W&B reports.",
    "Built a WebRTC whiteboard with Yjs CRDT sync so reviewers could annotate model outputs in real time.",
    "Shipped a monitoring dashboard (FastAPI + BigQuery) surfaced to the same repo for repeatable experiments.",
  ],
  outreachNote:
    "Hi Nova team — I’m excited about the ML Research Intern role. Here’s a RoBERTa experiment repo + real-time collab board that matches your requirements: https://github.com/demo-student/ml-research-notebooks",
  createdAt: new Date("2025-01-15T09:05:00Z").toISOString(),
};

export const demoJobs: Job[] = [demoJob];
export const demoProofs: Record<string, ProofPacket> = {
  [demoProof.jobId]: demoProof,
};
