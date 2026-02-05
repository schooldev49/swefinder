import type { Env } from "./env";
import type { Job, ProofPacket, Project, User } from "@swefinder/types";

const USER_PREFIX = "user:";
const USER_BY_GITHUB_PREFIX = "user:github:";
const PROJECTS_PREFIX = "projects:";
const JOB_PREFIX = "job:";
const JOB_INDEX_PREFIX = "jobs:index:";
const TOKEN_PREFIX = "token:";
const PROOF_PREFIX = "proof:";
const OAUTH_STATE_PREFIX = "oauth-state:";

export async function saveUser(env: Env, user: User): Promise<User> {
  await env.DATA_KV.put(`${USER_PREFIX}${user.id}`, JSON.stringify(user));
  await env.DATA_KV.put(`${USER_BY_GITHUB_PREFIX}${user.githubId}`, user.id);
  return user;
}

export async function getUserByGitHubId(env: Env, githubId: number): Promise<User | null> {
  const userId = await env.DATA_KV.get(`${USER_BY_GITHUB_PREFIX}${githubId}`);
  if (!userId) return null;
  return getUserById(env, userId);
}

export async function getUserById(env: Env, userId: string): Promise<User | null> {
  const raw = await env.DATA_KV.get(`${USER_PREFIX}${userId}`);
  return raw ? (JSON.parse(raw) as User) : null;
}

export async function saveProjects(env: Env, userId: string, projects: Project[]): Promise<Project[]> {
  await env.DATA_KV.put(`${PROJECTS_PREFIX}${userId}`, JSON.stringify(projects));
  return projects;
}

export async function listProjects(env: Env, userId: string): Promise<Project[]> {
  const raw = await env.DATA_KV.get(`${PROJECTS_PREFIX}${userId}`);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Project[];
  } catch {
    return [];
  }
}

export async function saveJob(env: Env, job: Job): Promise<Job> {
  await env.DATA_KV.put(`${JOB_PREFIX}${job.id}`, JSON.stringify(job));
  const indexKey = `${JOB_INDEX_PREFIX}${job.userId}`;
  const existingRaw = await env.DATA_KV.get(indexKey);
  const ids = existingRaw ? (JSON.parse(existingRaw) as string[]) : [];
  if (!ids.includes(job.id)) {
    ids.unshift(job.id);
    await env.DATA_KV.put(indexKey, JSON.stringify(ids));
  }
  return job;
}

export async function updateJob(env: Env, job: Job): Promise<Job> {
  await env.DATA_KV.put(`${JOB_PREFIX}${job.id}`, JSON.stringify(job));
  return job;
}

export async function getJob(env: Env, jobId: string): Promise<Job | null> {
  const raw = await env.DATA_KV.get(`${JOB_PREFIX}${jobId}`);
  return raw ? (JSON.parse(raw) as Job) : null;
}

export async function listJobs(env: Env, userId: string): Promise<Job[]> {
  const indexRaw = await env.DATA_KV.get(`${JOB_INDEX_PREFIX}${userId}`);
  if (!indexRaw) return [];
  const ids = JSON.parse(indexRaw) as string[];
  const jobs: Job[] = [];
  for (const id of ids) {
    const job = await getJob(env, id);
    if (job) jobs.push(job);
  }
  return jobs;
}

export async function saveProofPacket(env: Env, packet: ProofPacket): Promise<ProofPacket> {
  await env.DATA_KV.put(`${PROOF_PREFIX}${packet.jobId}`, JSON.stringify(packet));
  return packet;
}

export async function getProofPacket(env: Env, jobId: string): Promise<ProofPacket | null> {
  const raw = await env.DATA_KV.get(`${PROOF_PREFIX}${jobId}`);
  return raw ? (JSON.parse(raw) as ProofPacket) : null;
}

export async function saveEncryptedToken(env: Env, userId: string, encryptedToken: string): Promise<void> {
  await env.DATA_KV.put(`${TOKEN_PREFIX}${userId}`, encryptedToken);
}

export async function getEncryptedToken(env: Env, userId: string): Promise<string | null> {
  return env.DATA_KV.get(`${TOKEN_PREFIX}${userId}`);
}

export async function storeOAuthState(env: Env, state: string, redirectPath: string | null): Promise<void> {
  await env.DATA_KV.put(`${OAUTH_STATE_PREFIX}${state}`, redirectPath || "", { expirationTtl: 600 });
}

export async function consumeOAuthState(env: Env, state: string): Promise<string | null> {
  const key = `${OAUTH_STATE_PREFIX}${state}`;
  const redirect = await env.DATA_KV.get(key);
  if (redirect !== null) {
    await env.DATA_KV.delete(key);
    return redirect || null;
  }
  return null;
}
