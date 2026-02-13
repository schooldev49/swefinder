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
export type AIRole = "none" | "assist" | "co-design" | "agent-orchestration";
export type CodeSampleType = "code" | "readme" | "commit";

export interface CommitEntry {
  sha: string;
  message: string;
  date?: string | null;
  htmlUrl?: string;
}

export interface ProjectSnapshot {
  projectId: string;
  projectFullName: string;
  commitSha?: string;
  committedAt?: string | null;
  commitUrl?: string;
}

export interface ProjectCodeSample {
  id: string;
  type?: CodeSampleType;
  summary: string;
  code: string;
  language?: string;
  filePath?: string;
  lineStart?: number;
  lineEnd?: number;
  url?: string;
  tags?: string[];
  readmeHeading?: string;
  commitEntries?: CommitEntry[];
  sourceCommitSha?: string;
  lastCommitDate?: string | null;
  createdAt?: string;
  updatedAt?: string;
  sourceLocked?: boolean;
  isPrivate?: boolean;
}

export interface Project {
  id: string;
  userId: string;
  sourceType: ProjectSourceType;
  fullName: string; // repo full name or custom title
  htmlUrl: string; // repo URL or canonical project URL
  externalUrl?: string; // optional additional link for external projects
  defaultBranch?: string;
  isPrivate?: boolean;
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
  aiRole?: AIRole;
  aiTools?: string[];
  aiSupervisionNotes?: string;
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
  isPrivate?: boolean;
  title: string;
  description?: string;
  repoPath?: string;
  fileUrl?: string;
  demoUrl?: string;
  year?: number;
  context?: string;
  metrics?: Record<string, EvidenceMetric>;
  codeSnippet?: EvidenceSnippet;
  sourceCommitSha?: string;
  lastCommitDate?: string | null;
  aiRole?: AIRole;
  aiTools?: string[];
  aiSupervisionNotes?: string;
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
  type?: CodeSampleType;
  summary: string;
  code: string;
  language?: string;
  filePath?: string;
  lineStart?: number;
  lineEnd?: number;
  url?: string;
  sourceCommitSha?: string;
  lastCommitDate?: string | null;
}

export interface ProofPacketCodeSample extends EvidenceSnippet {
  id: string;
  projectId: string;
  projectFullName: string;
  type?: CodeSampleType;
  tags?: string[];
  readmeHeading?: string;
  commitEntries?: CommitEntry[];
  sourceCommitSha?: string;
  lastCommitDate?: string | null;
  sourceLocked?: boolean;
  isPrivate?: boolean;
}

export interface RequirementCoverage {
  requirementId: string;
  projectIds: string[];
  sampleId?: string | null;
  rationale?: string;
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
  evidenceSnapshotAt?: string;
  snapshotCommits?: ProjectSnapshot[];
  codeSamples?: ProofPacketCodeSample[];
  readmeHighlight?: ProofPacketCodeSample;
  commitTrail?: ProofPacketCodeSample;
  requirementSampleMap?: Record<string, string | null>;
  requirementCoverageMap?: Record<string, RequirementCoverage>;
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
