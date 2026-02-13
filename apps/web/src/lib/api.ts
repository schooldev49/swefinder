import type { Job, ProofPacket, ProofPacketCodeSample, Project, Requirement, RequirementCoverage, User } from "@evidensify/types";

export interface ApiRepoSummary {
  id: string;
  name: string;
  fullName: string;
  isPrivate?: boolean;
  defaultBranch?: string;
  description?: string;
  htmlUrl: string;
  language?: string;
  topics: string[];
  updatedAt: string;
  stars: number;
  fork: boolean;
}

export interface CreateJobPayload {
  title: string;
  company?: string;
  jobUrl?: string;
  rawDescription: string;
}

export interface GeneratePayload {
  selectedProjectIds: string[];
  selectedSampleIds?: string[];
  requirements?: Array<{ id?: string; text: string; priority?: number; notes?: string }>;
  requirementCoverage?: RequirementCoverage[];
  userMetrics?: Record<string, { label: string; value: string }>;
}

export interface SnippetSuggestionPayload {
  summary: string;
  code: string;
}

export interface RequirementDraftPayload {
  id?: string;
  text: string;
  priority?: number;
  notes?: string;
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) || "/api";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const targetUrl = path.startsWith("http") ? path : `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const response = await fetch(targetUrl, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    ...init,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json().catch(() => {
    throw new Error("Invalid server response");
  });

  if (!data.success) {
    throw new Error(data.error || "Request failed");
  }

  return data.data as T;
}

async function shareFetch<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
    },
  });
  const data = await response.json().catch(() => {
    throw new Error("Invalid server response");
  });
  if (!data.success) {
    throw new Error(data.error || "Request failed");
  }
  return data.data as T;
}

export function fetchCurrentUser() {
  return apiFetch<User | null>("/me");
}

export type ProjectPayload = Omit<Project, "userId">;

export function fetchProjects() {
  return apiFetch<Project[]>("/projects");
}

export function saveProjects(projects: ProjectPayload[]) {
  return apiFetch<Project[]>("/projects", {
    method: "POST",
    body: JSON.stringify({ projects }),
  });
}

export function fetchGitHubRepos() {
  return apiFetch<ApiRepoSummary[]>("/github/repos");
}

export interface RepoTreeItem {
  path: string;
  size?: number;
}

export function fetchRepoReadmeContent(fullName: string) {
  const params = new URLSearchParams({ fullName });
  return apiFetch<{ content: string | null }>(`/github/readme?${params.toString()}`);
}

export interface RepoCommitSummary {
  sha: string;
  message: string;
  htmlUrl: string;
  date?: string | null;
}

export function fetchRepoCommitsList(fullName: string, limit = 20) {
  const params = new URLSearchParams({ fullName, limit: limit.toString() });
  return apiFetch<RepoCommitSummary[]>(`/github/commits?${params.toString()}`);
}

export function fetchRepoFileTree(fullName: string, ref?: string) {
  const params = new URLSearchParams({ fullName });
  if (ref) {
    params.set("ref", ref);
  }
  return apiFetch<RepoTreeItem[]>(`/github/file-tree?${params.toString()}`);
}

export interface RepoFileResponse {
  path: string;
  sha: string;
  size: number;
  content: string;
  ref?: string | null;
}

export function fetchRepoFileContent(fullName: string, path: string, ref?: string) {
  const params = new URLSearchParams({ fullName, path });
  if (ref) {
    params.set("ref", ref);
  }
  return apiFetch<RepoFileResponse>(`/github/file-content?${params.toString()}`);
}

export function createJob(payload: CreateJobPayload) {
  return apiFetch<Job>("/jobs", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchJobs() {
  return apiFetch<Job[]>("/jobs");
}

export function fetchJob(jobId: string) {
  return apiFetch<{ job: Job; proofPacket: ProofPacket | null }>(`/jobs/${jobId}`);
}

export function generateProof(jobId: string, payload: GeneratePayload) {
  return apiFetch<ProofPacket>(`/jobs/${jobId}/generate`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateJobStatus(jobId: string, status: Job["status"]) {
  return apiFetch<Job>(`/jobs/${jobId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export function deleteJob(jobId: string) {
  return apiFetch<{ id: string }>(`/jobs/${jobId}`, {
    method: "DELETE",
  });
}

export function logout() {
  return apiFetch<void>("/logout", { method: "POST" });
}

export function suggestSnippetSummary(payload: SnippetSuggestionPayload) {
  return apiFetch<{ suggestion: string }>("/snippets/suggest-summary", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function suggestSnippetTags(payload: SnippetSuggestionPayload) {
  return apiFetch<{ tags: string[] }>("/snippets/suggest-tags", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function suggestRequirements(jobDescription: string) {
  return apiFetch<{ requirements: RequirementDraftPayload[] }>("/requirements/suggest", {
    method: "POST",
    body: JSON.stringify({ jobDescription }),
  });
}

export function updateRequirementSample(jobId: string, payload: { requirementId: string; sampleId: string | null }) {
  return apiFetch<{ requirementSampleMap: Record<string, string | null> }>(`/jobs/${jobId}/requirement-samples`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateRequirementCoverage(
  jobId: string,
  payload: { requirementId: string; projectIds: string[]; sampleId: string | null; rationale: string }
) {
  return apiFetch<{
    requirementCoverageMap: Record<string, RequirementCoverage>;
    requirementSampleMap: Record<string, string | null>;
    mappings: ProofPacket["mappings"];
  }>(`/jobs/${jobId}/requirement-coverage`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateJobRequirements(
  jobId: string,
  payload: { requirements: Array<{ id?: string; text: string; priority?: number; notes?: string }> }
) {
  return apiFetch<{
    requirements: Requirement[];
    requirementCoverageMap: Record<string, RequirementCoverage>;
    requirementSampleMap: Record<string, string | null>;
    mappings: ProofPacket["mappings"];
  }>(`/jobs/${jobId}/requirements`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function suggestPacketWording(
  jobId: string,
  payload: { bullets: string[]; outreachNote: string }
) {
  return apiFetch<{ bullets: string[]; outreachNote: string }>(`/jobs/${jobId}/suggest-wording`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function createJobSample(
  jobId: string,
  payload: {
    projectId: string;
    type?: "code" | "readme" | "commit";
    summary: string;
    code: string;
    language?: string;
    filePath?: string;
    lineStart?: number;
    lineEnd?: number;
    url?: string;
    tags?: string[];
    readmeHeading?: string;
    commitEntries?: { sha: string; message: string; date?: string | null; htmlUrl?: string }[];
    saveToProject?: boolean;
  }
) {
  return apiFetch<{ sample: ProofPacketCodeSample; codeSamples: ProofPacketCodeSample[] }>(`/jobs/${jobId}/samples`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface ProfileResponse {
  user: User;
  projects: Project[];
}

export interface UpdateProfilePayload {
  profileSlug?: string;
  profilePublic?: boolean;
}

export function fetchProfile() {
  return apiFetch<ProfileResponse>("/profile");
}

export function updateProfile(payload: UpdateProfilePayload) {
  return apiFetch<User>("/profile", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchPublicProfile(slug: string) {
  return shareFetch<{ user: User; projects: Project[] }>(`/share/u/${slug}`);
}

export function fetchSharedPacket(handle: string, packetSlug: string) {
  return shareFetch<{ user: User; job: Job; proofPacket: ProofPacket | null }>(
    `/share/u/${handle}/packets/${packetSlug}`
  );
}
