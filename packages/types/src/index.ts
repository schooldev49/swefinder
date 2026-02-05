export type JobStatus =
  | "DRAFT"
  | "PROOF_GENERATED"
  | "APPLIED"
  | "INTERVIEW"
  | "REJECTED"
  | "OFFER";

export interface User {
  id: string;
  githubId: number;
  githubLogin: string;
  githubAvatarUrl: string;
  createdAt: string;
}

export interface Project {
  id: string;
  userId: string;
  fullName: string;
  htmlUrl: string;
  description?: string;
  primaryLanguage?: string;
  topics: string[];
  lastUpdated: string;
  demoUrl?: string;
  context?: string;
  year?: number;
}

export interface Job {
  id: string;
  userId: string;
  title: string;
  company?: string;
  jobUrl?: string;
  rawDescription: string;
  createdAt: string;
  status: JobStatus;
  proofPacketId?: string;
}

export interface Requirement {
  id: string;
  jobId: string;
  text: string;
  priority: number;
  notes?: string;
}

export interface EvidenceMetric {
  value: string | number;
  source: "user" | "repo";
}

export interface Evidence {
  id: string;
  projectId: string;
  projectFullName: string;
  title: string;
  description?: string;
  repoPath?: string;
  fileUrl?: string;
  demoUrl?: string;
  year?: number;
  context?: string;
  metrics?: Record<string, EvidenceMetric>;
}

export interface EvidenceMapping {
  id: string;
  requirementId: string;
  evidenceId: string;
  relevanceScore: number;
  rationale?: string;
}

export interface EvidenceMappingWithEvidence extends EvidenceMapping {
  evidence: Evidence;
}

export interface ProofPacket {
  id: string;
  jobId: string;
  title: string;
  summary: string;
  requirements: Requirement[];
  mappings: EvidenceMappingWithEvidence[];
  bullets: string[];
  outreachNote: string;
  createdAt: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface SessionData {
  userId: string;
  expiresAt: number;
}
