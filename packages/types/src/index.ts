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
  profileSlug?: string;
  profilePublic?: boolean;
}

export type ProjectSourceType = "github" | "link";

export interface ProjectCodeSample {
  id: string;
  summary: string;
  code: string;
  language?: string;
  filePath?: string;
  lineStart?: number;
  lineEnd?: number;
  url?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Project {
  id: string;
  userId: string;
  sourceType: ProjectSourceType;
  fullName: string; // repo full name or custom title
  htmlUrl: string; // repo URL or canonical project URL
  externalUrl?: string; // optional additional link for external projects
  description?: string;
  primaryLanguage?: string;
  topics: string[];
  lastUpdated: string;
  demoUrl?: string;
  context?: string;
  year?: number;
  createdAt?: string;
  updatedAt?: string;
  tags?: string[];
  isShowcased?: boolean;
  codeSamples?: ProjectCodeSample[];
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
  shareToken?: string;
  shareSlug?: string;
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
  sourceType?: ProjectSourceType;
  title: string;
  description?: string;
  repoPath?: string;
  fileUrl?: string;
  demoUrl?: string;
  year?: number;
  context?: string;
  metrics?: Record<string, EvidenceMetric>;
  codeSnippet?: EvidenceSnippet;
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

export interface EvidenceSnippet {
  summary: string;
  code: string;
  language?: string;
  filePath?: string;
  lineStart?: number;
  lineEnd?: number;
  url?: string;
}

export interface ProofPacketCodeSample extends EvidenceSnippet {
  id: string;
  projectId: string;
  projectFullName: string;
  tags?: string[];
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
  codeSamples?: ProofPacketCodeSample[];
  requirementSampleMap?: Record<string, string | null>;
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
