import type { Job, ProofPacket, Project, User } from "@evidensify/types";

export interface ApiRepoSummary {
  id: string;
  name: string;
  fullName: string;
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
  userMetrics?: Record<string, { label: string; value: string }>;
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

export function logout() {
  return apiFetch<void>("/logout", { method: "POST" });
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
  return shareFetch<{ user: User; projects: Project[] }>(`/share/users/${slug}`);
}

export function fetchSharedPacket(handle: string, packetSlug: string) {
  return shareFetch<{ user: User; job: Job; proofPacket: ProofPacket | null }>(
    `/share/users/${handle}/packets/${packetSlug}`
  );
}
