import type {
  EvidenceMappingWithEvidence,
  Job,
  ProofPacket,
  ProofPacketCodeSample,
  Project,
  ProjectCodeSample,
  Requirement,
  User,
} from "@evidensify/types";
import { callLLM } from "./llm/callLLM";
import {
  buildBulletsAndOutreachPrompt,
  buildEvidenceMappingPrompt,
  buildRequirementsPrompt,
  buildSnippetSummaryPrompt,
  buildSnippetTagsPrompt,
} from "./llm/prompts";
import type { Env } from "./env";
import { decryptToken, encryptToken } from "./crypto";
import { errorResponse, getAllowedOrigin, handleOptions, jsonResponse, parseJsonBody, withCors } from "./utils";
import {
  consumeOAuthState,
  getEncryptedToken,
  getJob,
  getJobIdBySlug,
  getJobIdByToken,
  getProofPacket,
  getUserByGitHubId,
  getUserById,
  getUserBySlug,
  listJobs,
  listProjects,
  saveEncryptedToken,
  saveJob,
  saveProjects,
  saveProofPacket,
  saveUser,
  storeOAuthState,
  updateJob,
} from "./storage";
import { exchangeCodeForToken, fetchGitHubUserProfile, fetchUserRepos } from "./github";
import { createSession, destroySession, getSession } from "./session";

interface CreateProjectsPayload {
  projects: Array<
    Partial<Project> & {
      fullName: string;
      htmlUrl?: string;
      lastUpdated?: string;
      topics?: string[];
      sourceType?: Project["sourceType"];
      externalUrl?: string;
    }
  >;
}

interface CreateJobPayload {
  title: string;
  company?: string;
  jobUrl?: string;
  rawDescription: string;
}

interface GeneratePayload {
  selectedProjectIds: string[];
  selectedSampleIds?: string[];
  userMetrics?: Record<string, { label: string; value: string }>;
}

interface UpdateStatusPayload {
  status: Job["status"];
}

interface SnippetSuggestionPayload {
  summary: string;
  code: string;
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

      if (url.pathname === "/api/profile" && request.method === "GET") {
        return withCors(await handleGetProfile(request, env), origin);
      }

      if (url.pathname === "/api/profile" && request.method === "POST") {
        return withCors(await handleUpdateProfile(request, env), origin);
      }

      if (url.pathname === "/api/snippets/suggest-summary" && request.method === "POST") {
        return withCors(await handleSuggestSnippetSummary(request, env), origin);
      }

      if (url.pathname === "/api/snippets/suggest-tags" && request.method === "POST") {
        return withCors(await handleSuggestSnippetTags(request, env), origin);
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

      const profileSlugMatch = url.pathname.match(/^\/share\/profile\/(?<slug>[a-z0-9-]+)/i);
      if (profileSlugMatch && request.method === "GET") {
        return withCors(await handlePublicProfile(request, env, profileSlugMatch.groups?.slug || ""), origin);
      }

      const userProfileMatch = url.pathname.match(/^\/share\/users\/(?<slug>[a-z0-9-]+)$/i);
      if (userProfileMatch && request.method === "GET") {
        return withCors(await handlePublicProfile(request, env, userProfileMatch.groups?.slug || ""), origin);
      }

      const userPacketMatch = url.pathname.match(
        /^\/share\/users\/(?<slug>[a-z0-9-]+)\/(?:(?:packets)\/)?(?<packetSlug>[a-z0-9-]+)/i
      );
      if (userPacketMatch && request.method === "GET") {
        return withCors(
          await handleSharedPacketBySlug(request, env, userPacketMatch.groups?.slug || "", userPacketMatch.groups?.packetSlug || ""),
          origin
        );
      }

      const packetMatch = url.pathname.match(/^\/share\/packet\/(?<token>[a-zA-Z0-9-]+)/);
      if (packetMatch && request.method === "GET") {
        return withCors(await handleSharedPacket(request, env, packetMatch.groups?.token || ""), origin);
      }

      if (env.ASSETS) {
        const assetResponse = await env.ASSETS.fetch(request);
        if (assetResponse.status !== 404) {
          return assetResponse;
        }

        const acceptsHtml = (request.headers.get("accept") || "").includes("text/html");
        if (request.method === "GET" && acceptsHtml) {
          const indexUrl = new URL(request.url);
          indexUrl.pathname = "/index.html";
          const indexRequest = new Request(indexUrl.toString(), {
            method: "GET",
            headers: new Headers(request.headers),
          });
          const indexResponse = await env.ASSETS.fetch(indexRequest);
          if (indexResponse.status !== 404) {
            return indexResponse;
          }
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
  const wantsPrivate = url.searchParams.get("private") === "1";
  githubAuthUrl.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  githubAuthUrl.searchParams.set("redirect_uri", redirectUri);
  githubAuthUrl.searchParams.set("scope", wantsPrivate ? "read:user repo" : "read:user public_repo");
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
  const error = url.searchParams.get("error");
  if (error) {
    const description = url.searchParams.get("error_description") || "Authorization was denied.";
    const storedRedirect = state ? await consumeOAuthState(env, state) : null;
    const destination = storedRedirect || env.FRONTEND_BASE_URL || "/";
    const friendly = new URL(destination, url.origin);
    friendly.searchParams.set("authError", description);
    return new Response(null, {
      status: 302,
      headers: {
        Location: friendly.toString(),
      },
    });
  }

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
  await ensureProfileDefaults(env, user, profile.login);
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
  const showcasedCount = normalized.filter((project) => project.isShowcased).length;
  if (showcasedCount > 4) {
    throw new HttpError("You can showcase at most 4 projects", 400);
  }
  await saveProjects(env, user.id, normalized);
  return jsonResponse(normalized);
}

async function handleCreateJob(request: Request, env: Env): Promise<Response> {
  const { user } = await requireUser(request, env);
  const payload = await parseJsonBody<CreateJobPayload>(request);
  if (!payload.title || !payload.rawDescription) {
    return errorResponse("title and rawDescription are required", 400);
  }
  const shareSlug = await generateJobShareSlug(env, user.id, payload.title, payload.company);
  const job: Job = {
    id: crypto.randomUUID(),
    userId: user.id,
    title: payload.title,
    company: payload.company,
    jobUrl: payload.jobUrl,
    rawDescription: payload.rawDescription,
    status: "DRAFT",
    createdAt: new Date().toISOString(),
    shareToken: crypto.randomUUID(),
    shareSlug,
  };
  await saveJob(env, job);
  return jsonResponse(job);
}

async function handleListJobs(request: Request, env: Env): Promise<Response> {
  const { user } = await requireUser(request, env);
  const jobs = await listJobs(env, user.id);
  const hydrated = await Promise.all(jobs.map((job) => ensureJobShareSlug(env, job)));
  return jsonResponse(hydrated);
}

async function handleGetProfile(request: Request, env: Env): Promise<Response> {
  const { user } = await requireUser(request, env);
  const projects = await listProjects(env, user.id);
  return jsonResponse({ user, projects });
}

interface ProfileSettingsPayload {
  profileSlug?: string;
  profilePublic?: boolean;
}

async function handleUpdateProfile(request: Request, env: Env): Promise<Response> {
  const { user } = await requireUser(request, env);
  const payload = await parseJsonBody<ProfileSettingsPayload>(request);
  if (payload.profileSlug !== undefined) {
    const slug = payload.profileSlug.trim().toLowerCase();
    validateProfileSlug(slug);
    const existing = await getUserBySlug(env, slug);
    if (existing && existing.id !== user.id) {
      throw new HttpError("That slug is already in use", 400);
    }
    user.profileSlug = slug;
  }
  if (typeof payload.profilePublic === "boolean") {
    user.profilePublic = payload.profilePublic;
  }
  await saveUser(env, user);
  return jsonResponse(user);
}

async function handleSuggestSnippetSummary(request: Request, env: Env): Promise<Response> {
  await requireUser(request, env);
  const payload = await parseJsonBody<SnippetSuggestionPayload>(request);
  const { summary, code } = validateSnippetPayload(payload);
  const suggestion = await runLLMForSnippetSummary(env, summary, code);
  return jsonResponse({ suggestion });
}

async function handleSuggestSnippetTags(request: Request, env: Env): Promise<Response> {
  await requireUser(request, env);
  const payload = await parseJsonBody<SnippetSuggestionPayload>(request);
  const { summary, code } = validateSnippetPayload(payload);
  const tags = await runLLMForSnippetTags(env, summary, code);
  return jsonResponse({ tags });
}

async function handleGetJob(request: Request, env: Env, jobId: string): Promise<Response> {
  const { user } = await requireUser(request, env);
  const job = await getJob(env, jobId);
  if (!job || job.userId !== user.id) {
    throw new HttpError("Job not found", 404);
  }
  const hydratedJob = await ensureJobShareSlug(env, job);
  const proof = await getProofPacket(env, jobId);
  return jsonResponse({ job: hydratedJob, proofPacket: proof });
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
  await ensureJobShareSlug(env, job);
  const projects = await listProjects(env, user.id);
  const selectedIds = Array.isArray(payload.selectedProjectIds) ? payload.selectedProjectIds : [];
  if (selectedIds.length === 0) {
    throw new HttpError("Select at least one project", 400);
  }
  const selectedProjects = projects.filter((project) => selectedIds.includes(project.id));
  if (selectedProjects.length === 0) {
    throw new HttpError("Select at least one project", 400);
  }
  const selectedSampleIds = Array.isArray(payload.selectedSampleIds) ? payload.selectedSampleIds : [];
  const codeSamples = buildProofCodeSamples(selectedSampleIds, selectedProjects);

  let requirements: Requirement[] = [];
  let mappings: EvidenceMappingWithEvidence[] = [];
  let bulletsResult: { bullets: string[]; outreachNote: string; summary: string };
  try {
    requirements = await runLLMForRequirements(env, job.rawDescription);
    mappings = await runLLMForMappings(env, job.rawDescription, requirements, selectedProjects);
    bulletsResult = await runLLMForBullets(env, requirements, mappings);
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
    codeSamples,
  };

  await saveProofPacket(env, proofPacket);
  job.status = "PROOF_GENERATED";
  job.proofPacketId = proofPacket.id;
  await updateJob(env, job);

  return jsonResponse(proofPacket);
}

async function runLLMForRequirements(env: Env, jobDescription: string): Promise<Requirement[]> {
  const response = await callLLM(env, {
    systemPrompt: "You extract key job requirements.",
    userPrompt: buildRequirementsPrompt(jobDescription),
    responseFormat: "json",
  });
  return JSON.parse(response.raw) as Requirement[];
}

async function runLLMForMappings(
  env: Env,
  jobDescription: string,
  requirements: Requirement[],
  projects: Project[]
): Promise<EvidenceMappingWithEvidence[]> {
  const response = await callLLM(env, {
    systemPrompt: "You match requirements to project evidence.",
    userPrompt: buildEvidenceMappingPrompt({ jobDescription, requirements, projects }),
    responseFormat: "json",
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
    sourceType: project?.sourceType,
    title: mapping.title || project?.fullName || "Evidence",
    description: mapping.description || project?.description,
    repoPath: mapping.repoPath,
    fileUrl: mapping.links?.[0],
    demoUrl: mapping.links?.[1],
    context: mapping.context || project?.context,
    year: mapping.year || project?.year,
  };
}

async function runLLMForBullets(env: Env, requirements: Requirement[], mappings: EvidenceMappingWithEvidence[]) {
  const response = await callLLM(env, {
    systemPrompt: "You craft plain-text resume bullets and outreach notes grounded in real evidence.",
    userPrompt: buildBulletsAndOutreachPrompt({ requirements, mappings }),
    responseFormat: "json",
  });
  return JSON.parse(response.raw) as { bullets: string[]; outreachNote: string; summary: string };
}

async function runLLMForSnippetSummary(env: Env, summary: string, code: string): Promise<string> {
  const prompt = buildSnippetSummaryPrompt({ summary, code });
  const response = await callLLM(env, {
    systemPrompt: "You rewrite summaries without adding new claims.",
    userPrompt: prompt,
  });
  return response.raw.trim();
}

async function runLLMForSnippetTags(env: Env, summary: string, code: string): Promise<string[]> {
  const prompt = buildSnippetTagsPrompt({ summary, code });
  const response = await callLLM(env, {
    systemPrompt: "You suggest concise tags for code snippets.",
    userPrompt: prompt,
    responseFormat: "json",
  });
  try {
    const parsed = JSON.parse(response.raw) as { tags?: string[] };
    return (parsed.tags || []).map((tag) => tag.trim().toLowerCase()).filter((tag) => Boolean(tag));
  } catch {
    return [];
  }
}

async function handlePublicProfile(request: Request, env: Env, slug: string): Promise<Response> {
  const user = await getUserBySlug(env, slug.toLowerCase());
  if (!user || !user.profilePublic) {
    throw new HttpError("Profile not available", 404);
  }
  const projects = await listProjects(env, user.id);
  const showcased = projects.filter((project) => project.isShowcased);
  return jsonResponse({ user, projects: showcased });
}

async function handleSharedPacket(request: Request, env: Env, token: string): Promise<Response> {
  const jobId = await getJobIdByToken(env, token);
  if (!jobId) {
    throw new HttpError("Packet not found", 404);
  }
  const job = await getJob(env, jobId);
  if (!job) {
    throw new HttpError("Job not found", 404);
  }
  await ensureJobShareSlug(env, job);
  const proof = await getProofPacket(env, jobId);
  const user = await getUserById(env, job.userId);
  return jsonResponse({ job, proofPacket: proof, user });
}

async function handleSharedPacketBySlug(request: Request, env: Env, slug: string, jobSlug: string): Promise<Response> {
  if (!slug || !jobSlug) {
    throw new HttpError("Packet not found", 404);
  }
  const user = await getUserBySlug(env, slug.toLowerCase());
  if (!user) {
    throw new HttpError("Packet not found", 404);
  }
  const jobId = await getJobIdBySlug(env, user.id, jobSlug);
  if (!jobId) {
    throw new HttpError("Packet not found", 404);
  }
  const job = await getJob(env, jobId);
  if (!job) {
    throw new HttpError("Packet not found", 404);
  }
  await ensureJobShareSlug(env, job);
  const proof = await getProofPacket(env, job.id);
  return jsonResponse({ job, proofPacket: proof, user });
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
    isShowcased: Boolean(project.isShowcased),
    codeSamples: normalizeCodeSamples(project.codeSamples),
  };
}

const MAX_CODE_SAMPLES_PER_PROJECT = 10;
const MAX_SAMPLE_LINES = 40;
const MAX_SAMPLE_CODE_CHARS = 2000;
const MAX_SAMPLE_SUMMARY_CHARS = 200;

function normalizeCodeSamples(samples?: ProjectCodeSample[]): ProjectCodeSample[] {
  if (!samples || samples.length === 0) return [];
  const now = new Date().toISOString();
  const sanitized: ProjectCodeSample[] = [];
  for (const sample of samples.slice(0, MAX_CODE_SAMPLES_PER_PROJECT)) {
    const summary = (sample.summary || "").trim();
    const code = (sample.code || "").trim();
    if (!summary || !code) continue;
    const truncatedSummary = summary.slice(0, MAX_SAMPLE_SUMMARY_CHARS);
    const truncatedCode = code.slice(0, MAX_SAMPLE_CODE_CHARS);
    let lineStart = typeof sample.lineStart === "number" ? Math.max(1, Math.floor(sample.lineStart)) : undefined;
    let lineEnd = typeof sample.lineEnd === "number" ? Math.max(lineStart ?? 1, Math.floor(sample.lineEnd ?? 0)) : undefined;
    if (lineStart && lineEnd && lineEnd - lineStart > MAX_SAMPLE_LINES) {
      lineEnd = lineStart + MAX_SAMPLE_LINES;
    }
    const url = sample.url ? validateOptionalUrl(sample.url) : undefined;
    sanitized.push({
      id: sample.id || crypto.randomUUID(),
      summary: truncatedSummary,
      code: truncatedCode,
      language: sample.language || undefined,
      filePath: sample.filePath?.trim() || undefined,
      lineStart,
      lineEnd,
      url,
      tags: (sample.tags || []).map((tag) => tag.trim()).filter(Boolean).slice(0, 5),
      createdAt: sample.createdAt || now,
      updatedAt: now,
    });
  }
  return sanitized;
}

function validateOptionalUrl(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return validateProjectUrl(trimmed);
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

function validateProfileSlug(slug: string) {
  if (!slug || !/^[a-z0-9-]{3,30}$/.test(slug)) {
    throw new HttpError("Slug must be 3-30 lowercase letters, numbers, or dashes", 400);
  }
}

async function ensureProfileDefaults(env: Env, user: User, login: string) {
  if (!user.profileSlug) {
    const base = login.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    user.profileSlug = await generateAvailableSlug(env, base || `user-${user.id.slice(0, 6)}`);
  }
  if (typeof user.profilePublic !== "boolean") {
    user.profilePublic = false;
  }
}

async function generateAvailableSlug(env: Env, base: string): Promise<string> {
  // Normalize: lowercase, remove special chars, trim
  let candidate = base.toLowerCase().replace(/[^a-z0-9]/g, '-') || "user";
  if (candidate.length < 3) {
    candidate = `${candidate}-${Math.random().toString(36).substring(2, 7)}`;
  }

  const MAX_RETRIES = 10;
  
  for (let i = 0; i < MAX_RETRIES; i++) {
    // Strategy: Try the base, then try adding a random short string
    // This is often faster than sequential numbers (1, 2, 3...)
    const slug = i === 0 ? candidate : `${candidate}-${Math.random().toString(36).substring(2, 5)}`;
    
    const existing = await getUserBySlug(env, slug);
    if (!existing) return slug;
  }

  // Fallback: If we still haven't found one, use a timestamp to guarantee uniqueness
  return `${candidate}-${Date.now().toString(36)}`;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function generateJobShareSlug(env: Env, userId: string, title: string, company?: string): Promise<string> {
  const baseInput = `${title || "role"} ${company || ""}`.trim() || title || "role";
  const base = slugify(baseInput) || `role-${Date.now().toString(36)}`;
  for (let attempt = 0; attempt < 10; attempt++) {
    const suffix = attempt === 0 ? "" : `-${Math.random().toString(36).slice(2, 6)}`;
    const candidate = `${base}${suffix}`.replace(/-+/g, "-").replace(/^-|-$/g, "");
    const existing = await getJobIdBySlug(env, userId, candidate);
    if (!existing) {
      return candidate;
    }
  }
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

async function ensureJobShareSlug(env: Env, job: Job): Promise<Job> {
  if (job.shareSlug) {
    return job;
  }
  job.shareSlug = await generateJobShareSlug(env, job.userId, job.title, job.company);
  await updateJob(env, job);
  return job;
}

const MAX_PACKET_CODE_SAMPLES = 3;

function buildProofCodeSamples(selectedSampleIds: string[], projects: Project[]): ProofPacketCodeSample[] {
  if (!selectedSampleIds || selectedSampleIds.length === 0) {
    return [];
  }
  const trimmedIds = Array.from(new Set(selectedSampleIds)).slice(0, MAX_PACKET_CODE_SAMPLES);
  const samples: ProofPacketCodeSample[] = [];
  for (const id of trimmedIds) {
    for (const project of projects) {
      const sample = project.codeSamples?.find((entry) => entry.id === id);
      if (sample) {
        samples.push({
          id: sample.id,
          projectId: project.id,
          projectFullName: project.fullName,
          summary: sample.summary,
          code: sample.code,
          language: sample.language,
          filePath: sample.filePath,
          lineStart: sample.lineStart,
          lineEnd: sample.lineEnd,
          url: sample.url,
          tags: sample.tags,
        });
        break;
      }
    }
  }
  return samples;
}

const MAX_SNIPPET_CODE_LENGTH = 4000;
const MAX_SNIPPET_SUMMARY_LENGTH = 600;

function validateSnippetPayload(payload: SnippetSuggestionPayload): { summary: string; code: string } {
  const summary = (payload.summary || "").trim();
  const code = (payload.code || "").trim();
  if (!summary) {
    throw new HttpError("Provide a short summary first", 400);
  }
  if (!code) {
    throw new HttpError("Provide code for the snippet", 400);
  }
  if (summary.length > MAX_SNIPPET_SUMMARY_LENGTH) {
    throw new HttpError("Summary is too long", 400);
  }
  if (code.length > MAX_SNIPPET_CODE_LENGTH) {
    throw new HttpError("Code snippet is too long for suggestions", 400);
  }
  return { summary, code };
}
