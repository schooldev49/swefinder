import type { Job, ProofPacket, Project, User } from "@swefinder/types";
import type { ApiRepoSummary, CreateJobPayload, GeneratePayload, ProjectPayload } from "@/lib/api";
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

export async function createJob(_payload: CreateJobPayload): Promise<Job> {
  await sleep();
  return clone(demoJob);
}

export async function fetchJobs(): Promise<Job[]> {
  await sleep();
  return clone(demoJobs);
}

export async function fetchJob(): Promise<{ job: Job; proofPacket: ProofPacket | null }> {
  await sleep();
  return clone({ job: demoJob, proofPacket: demoProof });
}

export async function generateProof(_jobId: string, _payload: GeneratePayload): Promise<ProofPacket> {
  await sleep();
  return clone(demoProof);
}

export async function updateJobStatus(_jobId: string, status: Job["status"]): Promise<Job> {
  await sleep();
  return clone({ ...demoJob, status });
}

export async function logout() {
  await sleep();
  return undefined;
}
