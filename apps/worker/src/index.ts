import type { EvidenceMappingWithEvidence, Job, ProofPacket, Project, Requirement } from "@swefinder/types";
import { callLLM } from "./llm/callLLM";
import { buildBulletsAndOutreachPrompt, buildEvidenceMappingPrompt, buildRequirementsPrompt } from "./llm/prompts";
import type { Env } from "./env";
import { decryptToken, encryptToken } from "./crypto";
import { errorResponse, getAllowedOrigin, handleOptions, jsonResponse, parseJsonBody, withCors } from "./utils";
import { consumeOAuthState, getEncryptedToken, getJob, getProofPacket, getUserByGitHubId, getUserById, listJobs, listProjects, saveEncryptedToken, saveJob, saveProjects, saveProofPacket, saveUser, storeOAuthState, updateJob } from "./storage";
import { exchangeCodeForToken, fetchGitHubUserProfile, fetchUserRepos } from "./github";
import { createSession, destroySession, getSession } from "./session";

interface CreateProjectsPayload {
  projects: Array<Partial<Project> & { fullName: string; htmlUrl: string; lastUpdated: string; topics?: string[] }>; // minimal typing
}

interface CreateJobPayload {
  title: string;
  company?: string;
  jobUrl?: string;
  rawDescription: string;
}

interface GeneratePayload {
  selectedProjectIds: string[];
  userMetrics?: Record<string, { label: string; value: string }>;
}

interface UpdateStatusPayload {
  status: Job["status"];
}

class HttpError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

const routes = {
  async health(request: Request, env: Env) {
    return jsonResponse({ now: new Date().toISOString(), worker: "ok" });
  },
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return handleOptions(request, env);
    }

    const url = new URL(request.url);
    const origin = getAllowedOrigin(request, env);

    try {
      if (url.pathname === "/api/health") {
        return withCors(await routes.health(request, env), origin);
      }

      if (url.pathname === "/api/auth/github/login" && request.method === "GET") {
        return withCors(await handleGitHubLogin(request, env), origin);
      }

      if (url.pathname === "/api/auth/github/callback" && request.method === "GET") {
        return withCors(await handleGitHubCallback(request, env), origin);
      }

      if (url.pathname === "/api/logout" && request.method === "POST") {
        return withCors(await handleLogout(request, env), origin);
      }

      if (url.pathname === "/api/me" && request.method === "GET") {
        return withCors(await handleCurrentUser(request, env), origin);
      }

      if (url.pathname === "/api/github/repos" && request.method === "GET") {
        return withCors(await handleGitHubRepos(request, env), origin);
      }

      if (url.pathname === "/api/projects" && request.method === "POST") {
        return withCors(await handleSaveProjects(request, env), origin);
      }

      if (url.pathname === "/api/projects" && request.method === "GET") {
        return withCors(await handleListProjects(request, env), origin);
      }

      if (url.pathname === "/api/jobs" && request.method === "POST") {
        return withCors(await handleCreateJob(request, env), origin);
      }

      if (url.pathname === "/api/jobs" && request.method === "GET") {
        return withCors(await handleListJobs(request, env), origin);
      }

      const jobIdMatch = url.pathname.match(/^\/api\/jobs\/(?<jobId>[^\/]+)/);
      if (jobIdMatch) {
        const jobId = jobIdMatch.groups?.jobId || "";
        if (url.pathname.endsWith(`/api/jobs/${jobId}`) && request.method === "GET") {
          return withCors(await handleGetJob(request, env, jobId), origin);
        }
        if (url.pathname.endsWith(`/api/jobs/${jobId}/status`) && request.method === "PATCH") {
          return withCors(await handleUpdateJobStatus(request, env, jobId), origin);
        }
        if (url.pathname.endsWith(`/api/jobs/${jobId}/generate`) && request.method === "POST") {
          return withCors(await handleGenerateProofPacket(request, env, jobId), origin);
        }
      }

      return withCors(errorResponse("Not found", 404), origin);
    } catch (error) {
      console.error("Worker error", error);
      if (error instanceof HttpError) {
        return withCors(errorResponse(error.message, error.status), origin);
      }
      return withCors(errorResponse(error instanceof Error ? error.message : "Unexpected error", 500), origin);
    }
  },
};

async function handleGitHubLogin(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const redirectUri = `${url.origin}/api/auth/github/callback`;
  const state = crypto.randomUUID();
  const redirectTo = url.searchParams.get("redirect") || null;
  await storeOAuthState(env, state, redirectTo);
  const githubAuthUrl = new URL("https://github.com/login/oauth/authorize");
  githubAuthUrl.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  githubAuthUrl.searchParams.set("redirect_uri", redirectUri);
  githubAuthUrl.searchParams.set("scope", "read:user repo");
  githubAuthUrl.searchParams.set("state", state);
  return new Response(null, {
    status: 302,
    headers: {
      Location: githubAuthUrl.toString(),
    },
  });
}

async function handleGitHubCallback(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) {
    return errorResponse("Missing code or state", 400);
  }
  const storedRedirect = await consumeOAuthState(env, state);
  const redirectUri = `${url.origin}/api/auth/github/callback`;
  const tokenResponse = await exchangeCodeForToken(env, code, redirectUri);
  const profile = await fetchGitHubUserProfile(tokenResponse.access_token);

  let user = await getUserByGitHubId(env, profile.id);
  if (!user) {
    user = {
      id: crypto.randomUUID(),
      githubId: profile.id,
      githubLogin: profile.login,
      githubAvatarUrl: profile.avatar_url,
      createdAt: new Date().toISOString(),
    };
  } else {
    user = { ...user, githubLogin: profile.login, githubAvatarUrl: profile.avatar_url };
  }
  await saveUser(env, user);

  const encrypted = await encryptToken(env, tokenResponse.access_token);
  await saveEncryptedToken(env, user.id, encrypted);

  const { cookie } = await createSession(env, user.id);

  const destination = storedRedirect || env.FRONTEND_BASE_URL || "/";
  return new Response(null, {
    status: 302,
    headers: {
      Location: destination,
      "Set-Cookie": cookie,
    },
  });
}

async function handleLogout(request: Request, env: Env): Promise<Response> {
  const clearedCookie = await destroySession(env, request);
  return new Response(null, {
    status: 204,
    headers: {
      "Set-Cookie": clearedCookie,
    },
  });
}

async function handleCurrentUser(request: Request, env: Env): Promise<Response> {
  const session = await getSession(env, request);
  if (!session) {
    return jsonResponse(null);
  }
  const user = await getUserById(env, session.userId);
  if (!user) {
    return jsonResponse(null);
  }
  return jsonResponse(user);
}

async function requireUser(request: Request, env: Env) {
  const session = await getSession(env, request);
  if (!session) {
    throw new HttpError("Unauthorized", 401);
  }
  const user = await getUserById(env, session.userId);
  if (!user) {
    throw new HttpError("Unauthorized", 401);
  }
  return { user };
}

async function handleGitHubRepos(request: Request, env: Env): Promise<Response> {
  const { user } = await requireUser(request, env);
  const encryptedToken = await getEncryptedToken(env, user.id);
  const token = await decryptToken(env, encryptedToken);
  if (!token) {
    throw new HttpError("Missing GitHub token", 401);
  }
  const repos = await fetchUserRepos(token);
  return jsonResponse(
    repos.map((repo) => ({
      id: `${repo.id}`,
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description,
      htmlUrl: repo.html_url,
      language: repo.language,
      topics: repo.topics || [],
      updatedAt: repo.updated_at,
      stars: repo.stargazers_count,
      fork: repo.fork,
    }))
  );
}

async function handleListProjects(request: Request, env: Env): Promise<Response> {
  const { user } = await requireUser(request, env);
  const projects = await listProjects(env, user.id);
  return jsonResponse(projects);
}

async function handleSaveProjects(request: Request, env: Env): Promise<Response> {
  const { user } = await requireUser(request, env);
  const payload = await parseJsonBody<CreateProjectsPayload>(request);
  if (!payload.projects || !Array.isArray(payload.projects)) {
    return errorResponse("Invalid project payload", 400);
  }
  const normalized: Project[] = payload.projects.map((project) => normalizeProjectPayload(project, user.id));
  await saveProjects(env, user.id, normalized);
  return jsonResponse(normalized);
}

async function handleCreateJob(request: Request, env: Env): Promise<Response> {
  const { user } = await requireUser(request, env);
  const payload = await parseJsonBody<CreateJobPayload>(request);
  if (!payload.title || !payload.rawDescription) {
    return errorResponse("title and rawDescription are required", 400);
  }
  const job: Job = {
    id: crypto.randomUUID(),
    userId: user.id,
    title: payload.title,
    company: payload.company,
    jobUrl: payload.jobUrl,
    rawDescription: payload.rawDescription,
    status: "DRAFT",
    createdAt: new Date().toISOString(),
  };
  await saveJob(env, job);
  return jsonResponse(job);
}

async function handleListJobs(request: Request, env: Env): Promise<Response> {
  const { user } = await requireUser(request, env);
  const jobs = await listJobs(env, user.id);
  return jsonResponse(jobs);
}

async function handleGetJob(request: Request, env: Env, jobId: string): Promise<Response> {
  const { user } = await requireUser(request, env);
  const job = await getJob(env, jobId);
  if (!job || job.userId !== user.id) {
    throw new HttpError("Job not found", 404);
  }
  const proof = await getProofPacket(env, jobId);
  return jsonResponse({ job, proofPacket: proof });
}

async function handleUpdateJobStatus(request: Request, env: Env, jobId: string): Promise<Response> {
  const { user } = await requireUser(request, env);
  const payload = await parseJsonBody<UpdateStatusPayload>(request);
  if (!payload.status) {
    throw new HttpError("status is required", 400);
  }
  const job = await getJob(env, jobId);
  if (!job || job.userId !== user.id) {
    throw new HttpError("Job not found", 404);
  }
  job.status = payload.status;
  await updateJob(env, job);
  return jsonResponse(job);
}

async function handleGenerateProofPacket(request: Request, env: Env, jobId: string): Promise<Response> {
  const { user } = await requireUser(request, env);
  const payload = await parseJsonBody<GeneratePayload>(request);
  const job = await getJob(env, jobId);
  if (!job || job.userId !== user.id) {
    throw new HttpError("Job not found", 404);
  }
  const projects = await listProjects(env, user.id);
  const selectedIds = Array.isArray(payload.selectedProjectIds) ? payload.selectedProjectIds : [];
  if (selectedIds.length === 0) {
    throw new HttpError("Select at least one project", 400);
  }
  const selectedProjects = projects.filter((project) => selectedIds.includes(project.id));
  if (selectedProjects.length === 0) {
    throw new HttpError("Select at least one project", 400);
  }

  let requirements: Requirement[] = [];
  let mappings: EvidenceMappingWithEvidence[] = [];
  let bulletsResult: { bullets: string[]; outreachNote: string; summary: string };
  try {
    requirements = await runLLMForRequirements(job.rawDescription);
    mappings = await runLLMForMappings(job.rawDescription, requirements, selectedProjects);
    bulletsResult = await runLLMForBullets(requirements, mappings);
  } catch (error) {
    throw new HttpError(error instanceof Error ? error.message : "LLM generation failed", 502);
  }

  const proofPacket: ProofPacket = {
    id: crypto.randomUUID(),
    jobId: job.id,
    title: `Proof Packet – ${job.title}${job.company ? ` @ ${job.company}` : ""}`,
    summary: bulletsResult.summary,
    requirements,
    mappings,
    bullets: bulletsResult.bullets,
    outreachNote: bulletsResult.outreachNote,
    createdAt: new Date().toISOString(),
  };

  await saveProofPacket(env, proofPacket);
  job.status = "PROOF_GENERATED";
  job.proofPacketId = proofPacket.id;
  await updateJob(env, job);

  return jsonResponse(proofPacket);
}

async function runLLMForRequirements(jobDescription: string): Promise<Requirement[]> {
  const response = await callLLM({
    systemPrompt: "You extract key job requirements.",
    userPrompt: buildRequirementsPrompt(jobDescription),
  });
  return JSON.parse(response.raw) as Requirement[];
}

async function runLLMForMappings(jobDescription: string, requirements: Requirement[], projects: Project[]): Promise<EvidenceMappingWithEvidence[]> {
  const response = await callLLM({
    systemPrompt: "You match requirements to project evidence.",
    userPrompt: buildEvidenceMappingPrompt({ jobDescription, requirements, projects }),
  });
  const parsed = JSON.parse(response.raw) as Array<{ requirementId: string; mappings: any[] }>;
  const flattened: EvidenceMappingWithEvidence[] = parsed.flatMap((entry) =>
    entry.mappings.map((mapping) => ({
      id: crypto.randomUUID(),
      requirementId: entry.requirementId,
      evidence: buildEvidenceFromMapping(mapping, projects),
      evidenceId: crypto.randomUUID(),
      relevanceScore: mapping.relevanceScore ?? 0.5,
      rationale: mapping.rationale,
    }))
  );
  return flattened;
}

function buildEvidenceFromMapping(mapping: any, projects: Project[]): EvidenceMappingWithEvidence["evidence"] {
  const project = projects.find((p) => p.fullName === mapping.projectFullName) || projects[0];
  return {
    id: crypto.randomUUID(),
    projectId: project?.id || crypto.randomUUID(),
    projectFullName: mapping.projectFullName || project?.fullName || "",
    title: mapping.title || project?.fullName || "Evidence",
    description: mapping.description || project?.description,
    repoPath: mapping.repoPath,
    fileUrl: mapping.links?.[0],
    demoUrl: mapping.links?.[1],
    context: mapping.context || project?.context,
    year: mapping.year || project?.year,
  };
}

async function runLLMForBullets(requirements: Requirement[], mappings: EvidenceMappingWithEvidence[]) {
  const response = await callLLM({
    systemPrompt: "You craft ATS-safe bullets and outreach notes.",
    userPrompt: buildBulletsAndOutreachPrompt({ requirements, mappings }),
  });
  return JSON.parse(response.raw) as { bullets: string[]; outreachNote: string; summary: string };
}

function normalizeProjectPayload(
  project: Partial<Project> & { id?: string; htmlUrl?: string; fullName?: string; sourceType?: string },
  userId: string
): Project {
  const now = new Date().toISOString();
  const sourceType: Project["sourceType"] = project.sourceType === "link" ? "link" : "github";
  const baseName = (project.fullName || project.htmlUrl || project.externalUrl || "").trim();
  if (!baseName) {
    throw new HttpError("Each project requires a name", 400);
  }
  const topics = project.topics?.filter(Boolean) ?? [];
  let htmlUrl = project.htmlUrl?.trim();
  let externalUrl = project.externalUrl?.trim();
  if (sourceType === "link") {
    const rawUrl = externalUrl || htmlUrl;
    if (!rawUrl) {
      throw new HttpError("Link projects require a URL", 400);
    }
    const sanitized = validateProjectUrl(rawUrl);
    externalUrl = sanitized;
    htmlUrl = sanitized;
  } else {
    if (!htmlUrl) {
      throw new HttpError("GitHub projects require a repository URL", 400);
    }
    htmlUrl = validateProjectUrl(htmlUrl);
  }

  return {
    id: project.id || crypto.randomUUID(),
    userId,
    sourceType,
    fullName: baseName,
    htmlUrl,
    externalUrl,
    description: project.description,
    primaryLanguage: project.primaryLanguage,
    topics,
    lastUpdated: project.lastUpdated || now,
    demoUrl: project.demoUrl,
    context: project.context,
    year: project.year,
    createdAt: project.createdAt || now,
    updatedAt: now,
    tags: project.tags ?? [],
  };
}

function validateProjectUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new HttpError("Invalid project URL", 400);
  }
  if (!["https:", "http:"].includes(parsed.protocol)) {
    throw new HttpError("Project URL must use http or https", 400);
  }
  if (parsed.protocol === "http:" && parsed.hostname !== "localhost") {
    throw new HttpError("Project URL must use https", 400);
  }
  if (!parsed.hostname) {
    throw new HttpError("Project URL missing hostname", 400);
  }
  if (url.length > 2048) {
    throw new HttpError("Project URL is too long", 400);
  }
  return parsed.toString();
}
