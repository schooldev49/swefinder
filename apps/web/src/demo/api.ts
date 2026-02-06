import type { Job, ProofPacket, Project, User } from "@swefinder/types";
import type {
  ApiRepoSummary,
  CreateJobPayload,
  GeneratePayload,
  ProfileResponse,
  ProjectPayload,
  UpdateProfilePayload,
} from "@/lib/api";
import { demoJob, demoJobs, demoProof, demoProjects, demoRepos, demoUser } from "./data";

function sleep(ms = 300) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clone<T>(value: T): T {
  return structuredClone ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}

export async function fetchCurrentUser(): Promise<User | null> {
  await sleep();
  return clone(demoUser);
}

export async function fetchProjects(): Promise<Project[]> {
  await sleep();
  return clone(demoProjects);
}

export async function saveProjects(projects: ProjectPayload[]): Promise<Project[]> {
  await sleep();
  return clone(projects.map((project) => ({ ...project, userId: demoUser.id })));
}

export async function fetchGitHubRepos(): Promise<ApiRepoSummary[]> {
  await sleep();
  return clone(demoRepos);
}

export async function createJob(payload: CreateJobPayload): Promise<Job> {
  await sleep();
  return clone({
    ...demoJob,
    id: `${demoJob.id}-${Math.random().toString(36).slice(2, 6)}`,
    title: payload.title,
    company: payload.company || demoJob.company,
    jobUrl: payload.jobUrl || demoJob.jobUrl,
    rawDescription: payload.rawDescription,
  });
}

export async function fetchJobs(): Promise<Job[]> {
  await sleep();
  return clone(demoJobs);
}

export async function fetchJob(): Promise<{ job: Job; proofPacket: ProofPacket | null }> {
  await sleep();
  return clone({ job: demoJob, proofPacket: demoProof });
}

export async function generateProof(jobId: string, payload: GeneratePayload): Promise<ProofPacket> {
  await sleep();
  const projectCount = payload.selectedProjectIds?.length ?? 0;
  return clone({
    ...demoProof,
    jobId,
    summary: projectCount ? `Generated from ${projectCount} selected project(s)` : demoProof.summary,
  });
}

export async function updateJobStatus(jobId: string, status: Job["status"]): Promise<Job> {
  await sleep();
  return clone({ ...demoJob, id: jobId, status });
}

export async function fetchProfile(): Promise<ProfileResponse> {
  await sleep();
  return clone({ user: demoUser, projects: demoProjects });
}

export async function updateProfile(payload: UpdateProfilePayload): Promise<User> {
  await sleep();
  if (payload.profileSlug !== undefined) {
    demoUser.profileSlug = payload.profileSlug;
  }
  if (typeof payload.profilePublic === "boolean") {
    demoUser.profilePublic = payload.profilePublic;
  }
  return clone(demoUser);
}

export async function fetchPublicProfile(_slug?: string): Promise<ProfileResponse> {
  await sleep();
  return clone({ user: demoUser, projects: demoProjects.filter((project) => project.isShowcased) });
}

export async function fetchSharedPacket(
  handle: string,
  packetSlug: string
): Promise<{ user: User; job: Job; proofPacket: ProofPacket | null }> {
  await sleep();
  return clone({
    user: { ...demoUser, profileSlug: handle || demoUser.profileSlug },
    job: { ...demoJob, shareSlug: packetSlug || demoJob.shareSlug },
    proofPacket: demoProof,
  });
}

export async function logout() {
  await sleep();
  return undefined;
}
