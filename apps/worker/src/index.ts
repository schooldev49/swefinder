import type {
  AIRole,
  EvidenceMappingWithEvidence,
  Job,
  ProjectSnapshot,
  ProofPacket,
  ProofPacketCodeSample,
  Project,
  ProjectCodeSample,
  RequirementCoverage,
  Requirement,
  User,
} from "@evidensify/types";
import { callLLM } from "./llm/callLLM";
import {
  buildRequirementsPrompt,
  buildGrammarPolishPrompt,
  buildSnippetSummaryPrompt,
  buildSnippetTagsPrompt,
} from "./llm/prompts";
import type { Env } from "./env";
import { decryptToken, encryptToken } from "./crypto";
import { errorResponse, getAllowedOrigin, handleOptions, jsonResponse, parseJsonBody, withCors } from "./utils";
import {
  consumeOAuthState,
  deleteJobRecord,
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
import {
  exchangeCodeForToken,
  fetchGitHubUserProfile,
  fetchRepoFileText,
  fetchRepoReadme,
  fetchRepoTree,
  fetchRepoCommits,
  fetchCommitDetail,
  fetchUserRepos,
} from "./github";
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
  requirements?: Array<{ id?: string; text: string; priority?: number; notes?: string }>;
  requirementCoverage?: RequirementCoverage[];
  userMetrics?: Record<string, { label: string; value: string }>;
}

interface UpdateStatusPayload {
  status: Job["status"];
}

interface SnippetSuggestionPayload {
  summary: string;
  code: string;
}

interface SuggestRequirementsPayload {
  jobDescription: string;
}

interface RequirementSamplePayload {
  requirementId: string;
  sampleId: string | null;
}

interface RequirementCoveragePayload {
  requirementId: string;
  projectIds: string[];
  sampleId: string | null;
  rationale?: string;
}

interface CreateJobSamplePayload {
  projectId: string;
  type?: ProjectCodeSample["type"];
  summary: string;
  why?: string;
  tradeoffLimit?: string;
  code?: string;
  language?: string;
  filePath?: string;
  lineStart?: number;
  lineEnd?: number;
  url?: string;
  tags?: string[];
  authorshipContext?: string;
  readmeHeading?: string;
  commitEntries?: ProjectCodeSample["commitEntries"];
  saveToProject?: boolean;
}

interface UpdateRequirementsPayload {
  requirements: Array<{ id?: string; text: string; priority?: number; notes?: string }>;
}

interface SuggestPacketWordingPayload {
  bullets?: string[];
  outreachNote?: string;
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

      if (url.pathname === "/api/github/file-tree" && request.method === "GET") {
        return withCors(await handleGitHubFileTree(request, env), origin);
      }

      if (url.pathname === "/api/github/file-content" && request.method === "GET") {
        return withCors(await handleGitHubFileContent(request, env), origin);
      }

      if (url.pathname === "/api/github/readme" && request.method === "GET") {
        return withCors(await handleGitHubReadme(request, env), origin);
      }

      if (url.pathname === "/api/github/commits" && request.method === "GET") {
        return withCors(await handleGitHubCommits(request, env), origin);
      }

      if (url.pathname === "/api/github/commit-diff" && request.method === "GET") {
        return withCors(await handleGitHubCommitDiff(request, env), origin);
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

      if (url.pathname === "/api/requirements/suggest" && request.method === "POST") {
        return withCors(await handleSuggestRequirements(request, env), origin);
      }

      const jobIdMatch = url.pathname.match(/^\/api\/jobs\/(?<jobId>[^\/]+)/);
      if (jobIdMatch) {
        const jobId = jobIdMatch.groups?.jobId || "";
        if (url.pathname.endsWith(`/api/jobs/${jobId}`) && request.method === "GET") {
          return withCors(await handleGetJob(request, env, jobId), origin);
        }
        if (url.pathname.endsWith(`/api/jobs/${jobId}`) && request.method === "DELETE") {
          return withCors(await handleDeleteJob(request, env, jobId), origin);
        }
        if (url.pathname.endsWith(`/api/jobs/${jobId}/status`) && request.method === "PATCH") {
          return withCors(await handleUpdateJobStatus(request, env, jobId), origin);
        }
        if (url.pathname.endsWith(`/api/jobs/${jobId}/generate`) && request.method === "POST") {
          return withCors(await handleGenerateProofPacket(request, env, jobId), origin);
        }
        if (url.pathname.endsWith(`/api/jobs/${jobId}/refresh-snapshot`) && request.method === "POST") {
          return withCors(await handleRefreshProofSnapshot(request, env, jobId), origin);
        }
        if (url.pathname.endsWith(`/api/jobs/${jobId}/requirement-samples`) && request.method === "POST") {
          return withCors(await handleUpdateRequirementSample(request, env, jobId), origin);
        }
        if (url.pathname.endsWith(`/api/jobs/${jobId}/requirement-coverage`) && request.method === "POST") {
          return withCors(await handleUpdateRequirementCoverage(request, env, jobId), origin);
        }
        if (url.pathname.endsWith(`/api/jobs/${jobId}/requirements`) && request.method === "POST") {
          return withCors(await handleUpdateRequirements(request, env, jobId), origin);
        }
        if (url.pathname.endsWith(`/api/jobs/${jobId}/samples`) && request.method === "POST") {
          return withCors(await handleCreateJobSample(request, env, jobId), origin);
        }
        if (url.pathname.endsWith(`/api/jobs/${jobId}/suggest-wording`) && request.method === "POST") {
          return withCors(await handleSuggestPacketWording(request, env, jobId), origin);
        }
      }

      const profileSlugMatch = url.pathname.match(/^\/share\/profile\/(?<slug>[a-z0-9-]+)/i);
      if (profileSlugMatch && request.method === "GET") {
        return withCors(await handlePublicProfile(request, env, profileSlugMatch.groups?.slug || ""), origin);
      }

      const userProfileMatch = url.pathname.match(/^\/share\/u\/(?<slug>[a-z0-9-]+)$/i);
      if (userProfileMatch && request.method === "GET") {
        return withCors(await handlePublicProfile(request, env, userProfileMatch.groups?.slug || ""), origin);
      }

      const userPacketMatch = url.pathname.match(
        /^\/share\/u\/(?<slug>[a-z0-9-]+)\/(?:(?:packets)\/)?(?<packetSlug>[a-z0-9-]+)/i
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
  githubAuthUrl.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  githubAuthUrl.searchParams.set("redirect_uri", redirectUri);
  githubAuthUrl.searchParams.set("scope", "read:user public_repo");
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
    repos
      .filter((repo) => !repo.private)
      .map((repo) => ({
      id: `${repo.id}`,
      name: repo.name,
      fullName: repo.full_name,
      isPrivate: false,
      defaultBranch: repo.default_branch,
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

async function handleGitHubFileTree(request: Request, env: Env): Promise<Response> {
  const { user } = await requireUser(request, env);
  const params = new URL(request.url).searchParams;
  const fullName = params.get("fullName");
  if (!fullName) {
    return errorResponse("Missing repository fullName", 400);
  }
  const ref = params.get("ref") || undefined;
  const encryptedToken = await getEncryptedToken(env, user.id);
  const token = await decryptToken(env, encryptedToken);
  if (!token) {
    throw new HttpError("Missing GitHub token", 401);
  }
  const tree = await fetchRepoTree(token, fullName, ref);
  const blobs = tree
    .filter((entry) => entry.type === "blob")
    .map((entry) => ({
      path: entry.path,
      size: entry.size ?? 0,
    }));
  return jsonResponse(blobs);
}

async function handleGitHubFileContent(request: Request, env: Env): Promise<Response> {
  const { user } = await requireUser(request, env);
  const params = new URL(request.url).searchParams;
  const fullName = params.get("fullName");
  const path = params.get("path");
  if (!fullName || !path) {
    return errorResponse("Missing repository or path", 400);
  }
  const ref = params.get("ref") || undefined;
  const encryptedToken = await getEncryptedToken(env, user.id);
  const token = await decryptToken(env, encryptedToken);
  if (!token) {
    throw new HttpError("Missing GitHub token", 401);
  }
  const file = await fetchRepoFileText(token, fullName, path, ref);
  if (file.size > 350_000) {
    throw new HttpError("File too large to preview. Pick a smaller snippet.", 400);
  }
  return jsonResponse({
    path: file.path,
    sha: file.sha,
    size: file.size,
    content: file.text,
    ref: ref || null,
  });
}

async function handleGitHubReadme(request: Request, env: Env): Promise<Response> {
  const { user } = await requireUser(request, env);
  const params = new URL(request.url).searchParams;
  const fullName = params.get("fullName");
  if (!fullName) {
    return errorResponse("Missing repository fullName", 400);
  }
  const encryptedToken = await getEncryptedToken(env, user.id);
  const token = await decryptToken(env, encryptedToken);
  if (!token) {
    throw new HttpError("Missing GitHub token", 401);
  }
  const readme = await fetchRepoReadme(token, fullName);
  if (!readme) {
    return jsonResponse({ content: null });
  }
  const trimmed = readme.slice(0, 20000);
  return jsonResponse({ content: trimmed });
}

async function handleGitHubCommits(request: Request, env: Env): Promise<Response> {
  const { user } = await requireUser(request, env);
  const params = new URL(request.url).searchParams;
  const fullName = params.get("fullName");
  if (!fullName) {
    return errorResponse("Missing repository fullName", 400);
  }
  const limitParam = Number.parseInt(params.get("limit") || "20", 10);
  const limit = Number.isNaN(limitParam) ? 20 : Math.min(Math.max(limitParam, 1), 50);
  const encryptedToken = await getEncryptedToken(env, user.id);
  const token = await decryptToken(env, encryptedToken);
  if (!token) {
    throw new HttpError("Missing GitHub token", 401);
  }
  const commits = await fetchRepoCommits(token, fullName, limit);
  const normalized = commits.map((commit) => ({
    sha: commit.sha,
    htmlUrl: commit.html_url,
    message: commit.commit?.message || "",
    date: commit.commit?.author?.date || null,
  }));
  return jsonResponse(normalized);
}

async function handleGitHubCommitDiff(request: Request, env: Env): Promise<Response> {
  const { user } = await requireUser(request, env);
  const params = new URL(request.url).searchParams;
  const fullName = params.get("fullName");
  const sha = params.get("sha");
  if (!fullName || !sha) {
    return errorResponse("Missing fullName or sha", 400);
  }
  const encryptedToken = await getEncryptedToken(env, user.id);
  const token = await decryptToken(env, encryptedToken);
  if (!token) {
    throw new HttpError("Missing GitHub token", 401);
  }
  const detail = await fetchCommitDetail(token, fullName, sha);
  const files = (detail.files || []).map((file) => file.filename);
  const patches = (detail.files || [])
    .map((file) => file.patch || "")
    .filter(Boolean)
    .join("\n");
  return jsonResponse({
    sha: detail.sha,
    htmlUrl: detail.html_url,
    message: detail.commit?.message || "",
    date: detail.commit?.author?.date || null,
    files,
    patch: patches,
  });
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
  if (showcasedCount > 3) {
    throw new HttpError("You can feature at most 3 projects on your public profile", 400);
  }
  const featured = normalized.flatMap((project) => project.codeSamples || []).filter((sample) => sample.isFeaturedProfile);
  const featuredCode = featured.filter((sample) => (sample.type || "code") === "code").length;
  const featuredReadme = featured.filter((sample) => sample.type === "readme").length;
  const featuredCommit = featured.filter((sample) => sample.type === "commit").length;
  if (featuredCode > 3) {
    throw new HttpError("Feature up to 3 code samples on your public profile", 400);
  }
  if (featuredCommit > 3) {
    throw new HttpError("Feature up to 3 commit samples on your public profile", 400);
  }
  if (featuredReadme > 1) {
    throw new HttpError("Feature only 1 README sample on your public profile", 400);
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

async function handleSuggestRequirements(request: Request, env: Env): Promise<Response> {
  await requireUser(request, env);
  const payload = await parseJsonBody<SuggestRequirementsPayload>(request);
  const jobDescription = (payload.jobDescription || "").trim();
  if (!jobDescription) {
    throw new HttpError("Job description is required", 400);
  }

  let suggestions: Array<{ id?: string; text: string; priority?: number; notes?: string }> = [];
  try {
    const response = await callLLM(env, {
      systemPrompt: `
You extract only coding-related, code-verifiable technical requirements from job descriptions.

Include:
- Programming languages
- Frameworks and libraries
- System design responsibilities
- API, database, ML, infra tasks
- Engineering actions that can be demonstrated via code

Exclude:
- Soft skills
- Years of experience
- Generic phrases (e.g., "fast-paced environment")
- Non-technical culture statements

Do not invent requirements.
Only extract what is explicitly stated or clearly implied.
Output concise, specific requirements suitable for mapping to code evidence.
`,
      userPrompt: buildRequirementsPrompt(jobDescription),
      responseFormat: "json",
      maxTokens: 500,
    });
    suggestions = parseSuggestedRequirements(response.raw);
  } catch {
    suggestions = [];
  }

  if (!suggestions.length) {
    suggestions = fallbackRequirementsFromDescription(jobDescription);
  }
  const normalized = normalizeRequirementsInput(suggestions, "draft");
  return jsonResponse({
    requirements: normalized.map((entry) => ({
      id: entry.id,
      text: entry.text,
      priority: entry.priority,
      notes: entry.notes,
    })),
  });
}

async function handleUpdateRequirementSample(request: Request, env: Env, jobId: string): Promise<Response> {
  const { user } = await requireUser(request, env);
  const payload = await parseJsonBody<RequirementSamplePayload>(request);
  if (!payload.requirementId) {
    throw new HttpError("requirementId is required", 400);
  }
  const job = await getJob(env, jobId);
  if (!job || job.userId !== user.id) {
    throw new HttpError("Job not found", 404);
  }
  const proof = await getProofPacket(env, jobId);
  if (!proof) {
    throw new HttpError("Generate a Proof Packet first", 400);
  }
  const requirement = proof.requirements.find((req) => req.id === payload.requirementId);
  if (!requirement) {
    throw new HttpError("Requirement not found", 404);
  }
  if (payload.sampleId) {
    const exists = proof.codeSamples?.some((sample) => sample.id === payload.sampleId);
    if (!exists) {
      throw new HttpError("Sample not available for this packet", 400);
    }
  }
  const nextMap = { ...(proof.requirementSampleMap || {}) };
  if (!payload.sampleId) {
    delete nextMap[payload.requirementId];
  } else {
    nextMap[payload.requirementId] = payload.sampleId;
  }
  proof.requirementSampleMap = nextMap;
  await saveProofPacket(env, proof);
  return jsonResponse({ requirementSampleMap: nextMap });
}

async function handleUpdateRequirementCoverage(request: Request, env: Env, jobId: string): Promise<Response> {
  const { user } = await requireUser(request, env);
  const payload = await parseJsonBody<RequirementCoveragePayload>(request);
  if (!payload.requirementId) {
    throw new HttpError("requirementId is required", 400);
  }
  const job = await getJob(env, jobId);
  if (!job || job.userId !== user.id) {
    throw new HttpError("Job not found", 404);
  }
  const proof = await getProofPacket(env, jobId);
  if (!proof) {
    throw new HttpError("Generate a Proof Packet first", 400);
  }
  const requirement = proof.requirements.find((req) => req.id === payload.requirementId);
  if (!requirement) {
    throw new HttpError("Requirement not found", 404);
  }

  const projects = await listProjects(env, user.id);
  const availableProjects = new Set(projects.map((project) => project.id));
  const projectIds = (payload.projectIds || []).filter((id) => availableProjects.has(id)).slice(0, 2);
  const availableSamples = new Set((proof.codeSamples || []).map((sample) => sample.id));
  const sampleId = payload.sampleId && availableSamples.has(payload.sampleId) ? payload.sampleId : null;
  const rationale = (payload.rationale || "").trim().slice(0, 240);

  const nextCoverageMap: Record<string, RequirementCoverage> = { ...(proof.requirementCoverageMap || {}) };
  if (projectIds.length === 0 && !sampleId && !rationale) {
    delete nextCoverageMap[payload.requirementId];
  } else {
    nextCoverageMap[payload.requirementId] = {
      requirementId: payload.requirementId,
      projectIds,
      sampleId,
      rationale: rationale || undefined,
    };
  }

  const coverageList = Object.values(nextCoverageMap);
  const snapshotLookup = createSnapshotLookup(proof.snapshotCommits);
  const nextMappings = buildMappingsFromCoverage(
    proof.requirements,
    projects,
    coverageList,
    proof.codeSamples || [],
    snapshotLookup
  );
  const nextSampleMap = toRequirementSampleMap(coverageList);

  proof.requirementCoverageMap = nextCoverageMap;
  proof.requirementSampleMap = nextSampleMap;
  proof.mappings = nextMappings;
  await saveProofPacket(env, proof);

  return jsonResponse({
    requirementCoverageMap: nextCoverageMap,
    requirementSampleMap: nextSampleMap,
    mappings: nextMappings,
  });
}

async function handleCreateJobSample(request: Request, env: Env, jobId: string): Promise<Response> {
  const { user } = await requireUser(request, env);
  const payload = await parseJsonBody<CreateJobSamplePayload>(request);
  if (!payload.projectId) throw new HttpError("projectId is required", 400);
  const sampleType = payload.type || "code";
  const hasCommitEntries = Boolean(payload.commitEntries && payload.commitEntries.length > 0);
  if (!payload.summary?.trim() || (!payload.code?.trim() && !(sampleType === "commit" && hasCommitEntries))) {
    throw new HttpError("summary and evidence content are required", 400);
  }

  const job = await getJob(env, jobId);
  if (!job || job.userId !== user.id) throw new HttpError("Job not found", 404);
  const proof = await getProofPacket(env, jobId);
  if (!proof) throw new HttpError("Generate a Proof Packet first", 400);

  const projects = await listProjects(env, user.id);
  const project = projects.find((entry) => entry.id === payload.projectId);
  if (!project) throw new HttpError("Project not found", 404);

  const normalizedProjectSamples = normalizeCodeSamples([
    {
      id: crypto.randomUUID(),
      type: payload.type || "code",
      summary: payload.summary,
      why: payload.why,
      tradeoffLimit: payload.tradeoffLimit,
      code: payload.code || "",
      language: payload.language,
      filePath: payload.filePath,
      lineStart: payload.lineStart,
      lineEnd: payload.lineEnd,
      url: payload.url,
      tags: payload.tags,
      authorshipContext: payload.authorshipContext,
      readmeHeading: payload.readmeHeading,
      commitEntries: payload.commitEntries,
      sourceLocked: true,
      isPrivate: project.isPrivate,
    },
  ]);
  const projectSample = normalizedProjectSamples[0];
  if (!projectSample) throw new HttpError("Invalid sample payload", 400);
  const snapshotLookup = createSnapshotLookup(proof.snapshotCommits);
  const proofSample = applySnapshotToSample(mapProjectSample(project, projectSample), snapshotLookup.get(project.id));

  const existingProofSamples = proof.codeSamples || [];
  const nextProofSamples = [proofSample, ...existingProofSamples.filter((sample) => sample.id !== proofSample.id)];
  proof.codeSamples = nextProofSamples.slice(0, 20);
  await saveProofPacket(env, proof);

  if (payload.saveToProject) {
    const updatedProjects = projects.map((entry) => {
      if (entry.id !== project.id) return entry;
      const nextSamples = [projectSample, ...(entry.codeSamples || []).filter((sample) => sample.id !== projectSample.id)];
      return { ...entry, codeSamples: normalizeCodeSamples(nextSamples), updatedAt: new Date().toISOString() };
    });
    await saveProjects(env, user.id, updatedProjects);
  }

  return jsonResponse({ sample: proofSample, codeSamples: proof.codeSamples || [] });
}

async function handleUpdateRequirements(request: Request, env: Env, jobId: string): Promise<Response> {
  const { user } = await requireUser(request, env);
  const payload = await parseJsonBody<UpdateRequirementsPayload>(request);
  const job = await getJob(env, jobId);
  if (!job || job.userId !== user.id) throw new HttpError("Job not found", 404);
  const proof = await getProofPacket(env, jobId);
  if (!proof) throw new HttpError("Generate a Proof Packet first", 400);

  const requirements = normalizeRequirementsInput(payload.requirements, job.id);
  const nextRequirementIds = new Set(requirements.map((entry) => entry.id));
  const nextCoverageMap = Object.fromEntries(
    Object.entries(proof.requirementCoverageMap || {}).filter(([requirementId]) => nextRequirementIds.has(requirementId))
  );
  const nextSampleMap = Object.fromEntries(
    Object.entries(proof.requirementSampleMap || {}).filter(([requirementId]) => nextRequirementIds.has(requirementId))
  );
  const projects = await listProjects(env, user.id);
  const snapshotLookup = createSnapshotLookup(proof.snapshotCommits);
  const mappings = buildMappingsFromCoverage(
    requirements,
    projects,
    Object.values(nextCoverageMap),
    proof.codeSamples || [],
    snapshotLookup
  );

  proof.requirements = requirements;
  proof.requirementCoverageMap = nextCoverageMap;
  proof.requirementSampleMap = nextSampleMap;
  proof.mappings = mappings;
  await saveProofPacket(env, proof);

  return jsonResponse({
    requirements,
    requirementCoverageMap: nextCoverageMap,
    requirementSampleMap: nextSampleMap,
    mappings,
  });
}

async function handleSuggestPacketWording(request: Request, env: Env, jobId: string): Promise<Response> {
  const { user } = await requireUser(request, env);
  const payload = await parseJsonBody<SuggestPacketWordingPayload>(request);
  const job = await getJob(env, jobId);
  if (!job || job.userId !== user.id) throw new HttpError("Job not found", 404);
  const proof = await getProofPacket(env, jobId);
  if (!proof) throw new HttpError("Generate a Proof Packet first", 400);

  const bullets = (payload.bullets || []).map((entry) => entry.trim()).filter(Boolean).slice(0, 8);
  const outreachNote = (payload.outreachNote || "").trim();
  if (!bullets.length && !outreachNote) {
    throw new HttpError("Provide bullets or outreach text to polish", 400);
  }

  const response = await callLLM(env, {
    systemPrompt: "You only polish grammar and clarity. Do not add or remove factual claims.",
    userPrompt: buildGrammarPolishPrompt({
      bullets,
      outreachNote,
      requirements: proof.requirements,
      mappings: proof.mappings,
    }),
    responseFormat: "json",
  });

  let polished: { bullets?: string[]; outreachNote?: string };
  try {
    polished = JSON.parse(response.raw) as { bullets?: string[]; outreachNote?: string };
  } catch {
    throw new HttpError("Could not parse wording suggestion", 502);
  }

  return jsonResponse({
    bullets: (polished.bullets || []).map((entry) => entry.trim()).filter(Boolean),
    outreachNote: (polished.outreachNote || "").trim(),
  });
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

async function handleDeleteJob(request: Request, env: Env, jobId: string): Promise<Response> {
  const { user } = await requireUser(request, env);
  const job = await getJob(env, jobId);
  if (!job || job.userId !== user.id) {
    throw new HttpError("Job not found", 404);
  }
  await deleteJobRecord(env, job);
  return jsonResponse({ id: jobId });
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
  if (selectedProjects.some((project) => project.isPrivate)) {
    throw new HttpError("Only public links are allowed in Proof Packets", 400);
  }
  const selectedSampleIds = Array.isArray(payload.selectedSampleIds) ? payload.selectedSampleIds : [];
  const sampleSelection = buildProofCodeSamples(selectedSampleIds, selectedProjects);
  const existingProof = await getProofPacket(env, jobId);
  const requirements = normalizeRequirementsInput(payload.requirements, job.id, existingProof?.requirements);
  const evidenceSnapshotAt = new Date().toISOString();
  const snapshotCommits = await resolveProjectSnapshots(env, user.id, selectedProjects);
  const snapshotLookup = createSnapshotLookup(snapshotCommits);
  const enrichedCodeSamples = applySnapshotToSamples(sampleSelection.codeSamples, snapshotLookup);
  const enrichedReadmeSample = sampleSelection.readmeSample
    ? applySnapshotToSample(sampleSelection.readmeSample, snapshotLookup.get(sampleSelection.readmeSample.projectId))
    : undefined;
  const enrichedCommitSample = sampleSelection.commitSample
    ? applySnapshotToSample(sampleSelection.commitSample, snapshotLookup.get(sampleSelection.commitSample.projectId))
    : undefined;
  const requirementCoverage = normalizeRequirementCoverage(payload.requirementCoverage, selectedProjects, enrichedCodeSamples);
  const requirementCoverageMap = toRequirementCoverageMap(requirementCoverage);
  const requirementSampleMap = toRequirementSampleMap(requirementCoverage);
  const mappings = buildMappingsFromCoverage(
    requirements,
    selectedProjects,
    requirementCoverage,
    enrichedCodeSamples,
    snapshotLookup
  );
  const defaultSummary = "Requirement-first packet. Candidate-curated links and rationale only.";

  const proofPacket: ProofPacket = {
    id: crypto.randomUUID(),
    jobId: job.id,
    title: `Proof Packet – ${job.title}${job.company ? ` @ ${job.company}` : ""}`,
    summary: existingProof?.summary || defaultSummary,
    requirements,
    mappings,
    bullets: existingProof?.bullets || [],
    outreachNote: existingProof?.outreachNote || "",
    createdAt: evidenceSnapshotAt,
    evidenceSnapshotAt,
    snapshotCommits,
    codeSamples: enrichedCodeSamples,
    readmeHighlight: enrichedReadmeSample,
    commitTrail: enrichedCommitSample,
    requirementCoverageMap,
    requirementSampleMap,
  };

  await saveProofPacket(env, proofPacket);
  job.status = "PROOF_GENERATED";
  job.proofPacketId = proofPacket.id;
  await updateJob(env, job);

  return jsonResponse(proofPacket);
}

async function handleRefreshProofSnapshot(request: Request, env: Env, jobId: string): Promise<Response> {
  const { user } = await requireUser(request, env);
  const job = await getJob(env, jobId);
  if (!job || job.userId !== user.id) {
    throw new HttpError("Job not found", 404);
  }
  const proof = await getProofPacket(env, jobId);
  if (!proof) {
    throw new HttpError("Generate a Proof Packet first", 400);
  }

  const projects = await listProjects(env, user.id);
  const projectIds = new Set<string>();
  Object.values(proof.requirementCoverageMap || {}).forEach((entry) => {
    (entry.projectIds || []).forEach((projectId) => projectIds.add(projectId));
  });
  (proof.codeSamples || []).forEach((sample) => projectIds.add(sample.projectId));
  (proof.mappings || []).forEach((mapping) => {
    if (mapping.evidence.projectId) {
      projectIds.add(mapping.evidence.projectId);
    }
  });

  const selectedProjects = projects.filter((project) => projectIds.has(project.id));
  const evidenceSnapshotAt = new Date().toISOString();
  const snapshotCommits = await resolveProjectSnapshots(env, user.id, selectedProjects);
  const snapshotLookup = createSnapshotLookup(snapshotCommits);

  const nextCodeSamples = applySnapshotToSamples(proof.codeSamples || [], snapshotLookup);
  const nextReadme = proof.readmeHighlight
    ? applySnapshotToSample(proof.readmeHighlight, snapshotLookup.get(proof.readmeHighlight.projectId))
    : undefined;
  const nextCommitTrail = proof.commitTrail
    ? applySnapshotToSample(proof.commitTrail, snapshotLookup.get(proof.commitTrail.projectId))
    : undefined;
  const nextMappings = buildMappingsFromCoverage(
    proof.requirements,
    projects,
    Object.values(proof.requirementCoverageMap || {}),
    nextCodeSamples,
    snapshotLookup
  );

  proof.evidenceSnapshotAt = evidenceSnapshotAt;
  proof.snapshotCommits = snapshotCommits;
  proof.codeSamples = nextCodeSamples;
  proof.readmeHighlight = nextReadme;
  proof.commitTrail = nextCommitTrail;
  proof.mappings = nextMappings;
  await saveProofPacket(env, proof);

  return jsonResponse(proof);
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
  const showcased = projects.filter((project) => project.isShowcased).slice(0, 3);
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
    if (project.isPrivate) {
      throw new HttpError("Private repositories are not supported. Use public links only.", 400);
    }
  }

  const aiRole = normalizeAiRole(project.aiRole);
  const aiTools = normalizeAiTools(project.aiTools);
  const aiSupervisionNotes = normalizeAiSupervisionNotes(project.aiSupervisionNotes);
  const normalizedYears = normalizeProjectYears(project.yearStart, project.yearEnd, project.yearPresent, project.year);

  return {
    id: project.id || crypto.randomUUID(),
    userId,
    sourceType,
    fullName: baseName,
    htmlUrl,
    externalUrl,
    description: project.description,
    whyItMatters: project.whyItMatters?.trim() || undefined,
    primaryLanguage: project.primaryLanguage,
    defaultBranch: project.defaultBranch,
    isPrivate: false,
    isFork: Boolean(project.isFork),
    topics,
    lastUpdated: project.lastUpdated || now,
    demoUrl: project.demoUrl,
    context: project.context,
    year: normalizedYears.year,
    yearStart: normalizedYears.yearStart,
    yearEnd: normalizedYears.yearEnd,
    yearPresent: normalizedYears.yearPresent,
    createdAt: project.createdAt || now,
    updatedAt: now,
    tags: project.tags ?? [],
    isShowcased: Boolean(project.isShowcased),
    codeSamples: normalizeCodeSamples(project.codeSamples),
    aiRole,
    aiTools,
    aiSupervisionNotes,
  };
}

const MAX_CODE_SAMPLES_PER_PROJECT = 10;
const MAX_SAMPLE_LINES = 40;
const MAX_SAMPLE_CODE_CHARS = 2000;
const MAX_SAMPLE_SUMMARY_CHARS = 200;
const MAX_AI_SUPERVISION_LENGTH = 400;
const MAX_AI_TOOLS = 5;
const MAX_AI_TOOL_LENGTH = 40;
const AI_ROLE_VALUES: AIRole[] = ["none", "assist", "co-design", "agent-orchestration"];
const MIN_PROJECT_YEAR = 1970;
const MAX_PROJECT_YEAR = 2100;

function normalizeProjectYears(
  yearStart?: number,
  yearEnd?: number,
  yearPresent?: boolean,
  legacyYear?: number
): { year?: number; yearStart?: number; yearEnd?: number; yearPresent?: boolean } {
  const nowYear = new Date().getFullYear();
  const clampYear = (value?: number) => {
    if (typeof value !== "number" || Number.isNaN(value)) return undefined;
    const rounded = Math.floor(value);
    if (rounded < MIN_PROJECT_YEAR || rounded > MAX_PROJECT_YEAR) return undefined;
    return rounded;
  };

  const fallbackYear = clampYear(legacyYear);
  const nextStart = clampYear(yearStart) ?? fallbackYear;
  const present = Boolean(yearPresent);
  let nextEnd = present ? undefined : clampYear(yearEnd) ?? fallbackYear;

  if (nextStart && nextEnd && nextEnd < nextStart) {
    nextEnd = nextStart;
  }

  const derivedYear =
    nextStart && ((present && nextStart === nowYear) || (!present && nextEnd && nextStart === nextEnd))
      ? nextStart
      : undefined;

  return {
    year: derivedYear ?? fallbackYear,
    yearStart: nextStart,
    yearEnd: present ? undefined : nextEnd,
    yearPresent: present || undefined,
  };
}

function normalizeCodeSamples(samples?: ProjectCodeSample[]): ProjectCodeSample[] {
  if (!samples || samples.length === 0) return [];
  const now = new Date().toISOString();
  const sanitized: ProjectCodeSample[] = [];
  for (const sample of samples.slice(0, MAX_CODE_SAMPLES_PER_PROJECT)) {
    const type = sample.type || "code";
    const summary = (sample.summary || "").trim();
    const code = (sample.code || "").trim();
    const commitEntries = (sample.commitEntries || []).slice(0, 20).map((entry) => ({
      sha: entry.sha,
      message: entry.message,
      date: entry.date,
      htmlUrl: entry.htmlUrl,
      patch: entry.patch,
      files: entry.files,
    }));
    const hasCommitEvidence = type === "commit" && commitEntries.length > 0;
    if (!summary || (!code && !hasCommitEvidence)) continue;
    const truncatedSummary = summary.slice(0, MAX_SAMPLE_SUMMARY_CHARS);
    const why = (sample.why || sample.authorshipContext || "").trim() || "Not provided";
    const tradeoffLimit = (sample.tradeoffLimit || "").trim() || "Not provided";
    const truncatedCode = code.slice(0, MAX_SAMPLE_CODE_CHARS);
    let lineStart = typeof sample.lineStart === "number" ? Math.max(1, Math.floor(sample.lineStart)) : undefined;
    let lineEnd = typeof sample.lineEnd === "number" ? Math.max(lineStart ?? 1, Math.floor(sample.lineEnd ?? 0)) : undefined;
    if (lineStart && lineEnd && lineEnd - lineStart > MAX_SAMPLE_LINES) {
      lineEnd = lineStart + MAX_SAMPLE_LINES;
    }
    const url = sample.url ? validateOptionalUrl(sample.url) : undefined;
    sanitized.push({
      id: sample.id || crypto.randomUUID(),
      type,
      summary: truncatedSummary,
      why: why.slice(0, 180),
      tradeoffLimit: tradeoffLimit.slice(0, 180),
      code: truncatedCode,
      language: sample.language || undefined,
      filePath: sample.filePath?.trim() || undefined,
      lineStart,
      lineEnd,
      url,
      tags: (sample.tags || []).map((tag) => tag.trim()).filter(Boolean).slice(0, 5),
      authorshipContext: sample.authorshipContext?.trim().slice(0, 200) || undefined,
      readmeHeading: sample.readmeHeading?.trim() || undefined,
      commitEntries,
      isFeaturedProfile: Boolean(sample.isFeaturedProfile),
      sourceCommitSha: sample.sourceCommitSha,
      lastCommitDate: sample.lastCommitDate || null,
      createdAt: sample.createdAt || now,
      updatedAt: now,
      sourceLocked: Boolean(sample.sourceLocked),
      isPrivate: sample.isPrivate,
    });
  }
  return sanitized;
}

function validateOptionalUrl(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return validateProjectUrl(trimmed);
}

function normalizeAiRole(role?: string | null): AIRole | undefined {
  if (!role) return undefined;
  const normalized = role.toLowerCase() as AIRole;
  return AI_ROLE_VALUES.includes(normalized) ? normalized : undefined;
}

function normalizeAiTools(tools?: string[] | null): string[] {
  if (!tools || tools.length === 0) return [];
  const unique = Array.from(
    new Set(
      tools
        .map((tool) => tool?.toString().trim())
        .filter((tool): tool is string => Boolean(tool))
    )
  );
  return unique.slice(0, MAX_AI_TOOLS).map((tool) => tool.slice(0, MAX_AI_TOOL_LENGTH));
}

function normalizeAiSupervisionNotes(notes?: string | null): string | undefined {
  if (!notes) return undefined;
  const trimmed = notes.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, MAX_AI_SUPERVISION_LENGTH);
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
  if (!slug || !/^[a-z0-9-]{3,20}$/.test(slug)) {
    throw new HttpError("Handle must be 3-20 lowercase letters, numbers, or dashes", 400);
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
  candidate = candidate.replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (candidate.length > 20) {
    candidate = candidate.slice(0, 20).replace(/-+$/g, "");
  }
  if (candidate.length < 3) {
    candidate = `${candidate}-${Math.random().toString(36).substring(2, 7)}`;
  }

  const MAX_RETRIES = 10;
  
  for (let i = 0; i < MAX_RETRIES; i++) {
    // Strategy: Try the base, then try adding a random short string
    // This is often faster than sequential numbers (1, 2, 3...)
    const suffix = Math.random().toString(36).substring(2, 5);
    const slug = i === 0 ? candidate : `${candidate.slice(0, Math.max(3, 16))}-${suffix}`;
    
    const existing = await getUserBySlug(env, slug);
    if (!existing) return slug;
  }

  // Fallback: If we still haven't found one, use a timestamp to guarantee uniqueness
  return `${candidate.slice(0, Math.max(3, 13))}-${Date.now().toString(36).slice(-6)}`;
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

interface ProofSampleSelection {
  codeSamples: ProofPacketCodeSample[];
  readmeSample?: ProofPacketCodeSample;
  commitSample?: ProofPacketCodeSample;
}

interface ProjectSnapshotLookupEntry {
  commitSha?: string;
  committedAt?: string | null;
  commitUrl?: string;
}

function normalizeRequirementCoverage(
  input: RequirementCoverage[] | undefined,
  selectedProjects: Project[],
  codeSamples: ProofPacketCodeSample[]
): RequirementCoverage[] {
  if (!input || input.length === 0) return [];
  const projectSet = new Set(selectedProjects.map((project) => project.id));
  const sampleSet = new Set(codeSamples.map((sample) => sample.id));
  return input
    .filter((entry) => entry && entry.requirementId)
    .map((entry) => {
      const projectIds = (entry.projectIds || []).filter((id) => projectSet.has(id)).slice(0, 2);
      const sampleId = entry.sampleId && sampleSet.has(entry.sampleId) ? entry.sampleId : null;
      const rationale = (entry.rationale || "").trim().slice(0, 240);
      return {
        requirementId: entry.requirementId,
        projectIds,
        sampleId,
        rationale: rationale || undefined,
      };
    });
}

function normalizeRequirementsInput(
  input: Array<{ id?: string; text: string; priority?: number; notes?: string }> | undefined,
  jobId: string,
  fallback?: Requirement[]
): Requirement[] {
  const source = input && input.length > 0 ? input : fallback || [];
  const cleaned = source
    .map((entry, index) => {
      const text = (entry.text || "").trim();
      if (!text) return null;
      const id = (entry.id || `req-${index + 1}`).trim();
      const priority = typeof entry.priority === "number" ? Math.max(1, Math.min(10, Math.floor(entry.priority))) : 10 - index;
      const notes = entry.notes?.trim();
      return {
        id,
        jobId,
        text: text.slice(0, 240),
        priority,
        notes: notes ? notes.slice(0, 240) : undefined,
      } as Requirement;
    })
    .filter((entry): entry is Requirement => Boolean(entry))
    .slice(0, 5);
  if (!cleaned.length) {
    throw new HttpError("Add at least one requirement before generating", 400);
  }
  return cleaned.map((entry, index) => ({ ...entry, priority: 10 - index }));
}

function toRequirementCoverageMap(input: RequirementCoverage[]): Record<string, RequirementCoverage> {
  return input.reduce<Record<string, RequirementCoverage>>((acc, entry) => {
    if (!entry.requirementId) return acc;
    acc[entry.requirementId] = entry;
    return acc;
  }, {});
}

function toRequirementSampleMap(input: RequirementCoverage[]): Record<string, string | null> {
  return input.reduce<Record<string, string | null>>((acc, entry) => {
    if (!entry.requirementId) return acc;
    if (entry.sampleId) {
      acc[entry.requirementId] = entry.sampleId;
    }
    return acc;
  }, {});
}

function buildMappingsFromCoverage(
  requirements: Requirement[],
  projects: Project[],
  coverage: RequirementCoverage[],
  samples: ProofPacketCodeSample[],
  snapshotLookup?: Map<string, ProjectSnapshotLookupEntry>
): EvidenceMappingWithEvidence[] {
  const coverageMap = new Map(coverage.map((entry) => [entry.requirementId, entry]));
  const sampleMap = new Map(samples.map((sample) => [sample.id, sample]));
  const mappings: EvidenceMappingWithEvidence[] = [];

  for (const requirement of requirements) {
    const coverageEntry = coverageMap.get(requirement.id);
    if (!coverageEntry) continue;
    const projectIds = (coverageEntry.projectIds || []).slice(0, 2);
    for (const projectId of projectIds) {
      const project = projects.find((entry) => entry.id === projectId);
      if (!project) continue;
      const mappedSample = coverageEntry.sampleId ? sampleMap.get(coverageEntry.sampleId) : undefined;
      mappings.push({
        id: crypto.randomUUID(),
        requirementId: requirement.id,
        evidenceId: crypto.randomUUID(),
        relevanceScore: 0.9,
        rationale: coverageEntry.rationale,
        evidence: {
          id: crypto.randomUUID(),
          projectId: project.id,
          projectFullName: project.fullName,
          sourceType: project.sourceType,
          isPrivate: project.isPrivate,
          title: project.fullName,
          description: project.description,
          fileUrl: project.htmlUrl,
          demoUrl: project.demoUrl,
          context: project.context,
          year: project.year,
          yearStart: project.yearStart,
          yearEnd: project.yearEnd,
          yearPresent: project.yearPresent,
          sourceCommitSha: snapshotLookup?.get(project.id)?.commitSha,
          lastCommitDate: snapshotLookup?.get(project.id)?.committedAt || project.lastUpdated,
          aiRole: project.aiRole,
          aiTools: project.aiTools ?? [],
          aiSupervisionNotes: project.aiSupervisionNotes,
              codeSnippet: mappedSample
                ? {
                    type: mappedSample.type,
                    summary: mappedSample.summary,
                    why: mappedSample.why,
                    tradeoffLimit: mappedSample.tradeoffLimit,
                    code: mappedSample.code,
                    language: mappedSample.language,
                filePath: mappedSample.filePath,
                lineStart: mappedSample.lineStart,
                lineEnd: mappedSample.lineEnd,
                url: mappedSample.url,
                sourceCommitSha: mappedSample.sourceCommitSha,
                lastCommitDate: mappedSample.lastCommitDate,
              }
            : undefined,
        },
      });
    }
  }
  return mappings;
}

function buildProofCodeSamples(selectedSampleIds: string[], projects: Project[]): ProofSampleSelection {
  const result: ProofSampleSelection = { codeSamples: [] };
  if (!selectedSampleIds || selectedSampleIds.length === 0) {
    return result;
  }

  const uniqueIds = Array.from(new Set(selectedSampleIds));

  for (const id of uniqueIds) {
    if (result.codeSamples.length >= MAX_PACKET_CODE_SAMPLES && result.readmeSample && result.commitSample) {
      break;
    }
    const { project, sample } = findProjectSample(projects, id);
    if (!project || !sample) continue;

    const normalized = mapProjectSample(project, sample);
    if (sample.type === "readme") {
      if (!result.readmeSample) {
        result.readmeSample = normalized;
      }
      continue;
    }
    if (sample.type === "commit") {
      if (!result.commitSample) {
        result.commitSample = normalized;
      }
      continue;
    }
    if (result.codeSamples.length < MAX_PACKET_CODE_SAMPLES) {
      result.codeSamples.push(normalized);
    }
  }

  return result;
}

function createSnapshotLookup(snapshotCommits?: ProjectSnapshot[]): Map<string, ProjectSnapshotLookupEntry> {
  return new Map(
    (snapshotCommits || []).map((entry) => [
      entry.projectId,
      {
        commitSha: entry.commitSha,
        committedAt: entry.committedAt || null,
        commitUrl: entry.commitUrl,
      },
    ])
  );
}

function applySnapshotToSample(
  sample: ProofPacketCodeSample,
  snapshot: ProjectSnapshotLookupEntry | undefined
): ProofPacketCodeSample {
  return {
    ...sample,
    sourceCommitSha: snapshot?.commitSha || sample.sourceCommitSha,
    lastCommitDate: snapshot?.committedAt || sample.lastCommitDate || null,
  };
}

function applySnapshotToSamples(
  samples: ProofPacketCodeSample[],
  snapshotLookup: Map<string, ProjectSnapshotLookupEntry>
): ProofPacketCodeSample[] {
  return samples.map((sample) => {
    const snapshot = snapshotLookup.get(sample.projectId);
    return {
      ...sample,
      sourceCommitSha: snapshot?.commitSha || sample.sourceCommitSha,
      lastCommitDate: snapshot?.committedAt || sample.lastCommitDate || null,
    };
  });
}

async function resolveProjectSnapshots(env: Env, userId: string, selectedProjects: Project[]): Promise<ProjectSnapshot[]> {
  const githubProjects = selectedProjects.filter((project) => project.sourceType === "github" && !project.isPrivate);
  if (!githubProjects.length) return [];
  const encryptedToken = await getEncryptedToken(env, userId);
  const token = await decryptToken(env, encryptedToken);
  if (!token) return [];

  const settled = await Promise.allSettled(
    githubProjects.map(async (project): Promise<ProjectSnapshot> => {
      const commits = await fetchRepoCommits(token, project.fullName, 1);
      const latest = commits[0];
      return {
        projectId: project.id,
        projectFullName: project.fullName,
        commitSha: latest?.sha,
        committedAt: latest?.commit?.author?.date || project.lastUpdated,
        commitUrl: latest?.html_url,
      };
    })
  );

  return settled
    .filter((entry): entry is PromiseFulfilledResult<ProjectSnapshot> => entry.status === "fulfilled")
    .map((entry) => entry.value);
}

function findProjectSample(projects: Project[], sampleId: string) {
  for (const project of projects) {
    const sample = project.codeSamples?.find((entry) => entry.id === sampleId);
    if (sample) {
      return { project, sample };
    }
  }
  return { project: undefined, sample: undefined };
}

function mapProjectSample(project: Project, sample: ProjectCodeSample): ProofPacketCodeSample {
  return {
    id: sample.id,
    projectId: project.id,
    projectFullName: project.fullName,
    type: sample.type || "code",
    summary: sample.summary,
    why: sample.why,
    tradeoffLimit: sample.tradeoffLimit,
    code: sample.code,
    language: sample.language,
    filePath: sample.filePath,
    lineStart: sample.lineStart,
    lineEnd: sample.lineEnd,
    url: sample.url,
    tags: sample.tags,
    authorshipContext: sample.authorshipContext,
    readmeHeading: sample.readmeHeading,
    commitEntries: sample.commitEntries,
    sourceCommitSha: sample.sourceCommitSha,
    lastCommitDate: sample.lastCommitDate,
    sourceLocked: sample.sourceLocked,
    isPrivate: project.isPrivate,
  };
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

function parseSuggestedRequirements(raw: string): Array<{ id?: string; text: string; priority?: number; notes?: string }> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  const candidateList = Array.isArray(parsed)
    ? parsed
    : typeof parsed === "object" && parsed !== null && Array.isArray((parsed as { requirements?: unknown[] }).requirements)
      ? (parsed as { requirements: unknown[] }).requirements
      : [];

  return candidateList.reduce<Array<{ id?: string; text: string; priority?: number; notes?: string }>>((acc, entry, index) => {
    if (!entry || typeof entry !== "object") return acc;
    const obj = entry as { id?: unknown; text?: unknown; priority?: unknown; notes?: unknown };
    const text = sanitizeRequirementText(typeof obj.text === "string" ? obj.text : "");
    if (!text || !isTechnicalRequirement(text) || isInvalidRequirementText(text)) return acc;
    acc.push({
      id: typeof obj.id === "string" && obj.id.trim() ? obj.id.trim() : `req-${index + 1}`,
      text,
      priority: typeof obj.priority === "number" ? obj.priority : undefined,
      notes: typeof obj.notes === "string" ? sanitizeRequirementText(obj.notes, 140) : undefined,
    });
    return acc;
  }, []);
}

function fallbackRequirementsFromDescription(jobDescription: string): Array<{ id?: string; text: string; priority?: number; notes?: string }> {
  const lines = jobDescription
    .split(/\r?\n/)
    .map((line) => line.replace(/^[•*\-\d.)\s]+/, "").trim())
    .filter((line) => line.length > 12);
  const unique: string[] = [];
  for (const line of lines) {
    if (!isTechnicalRequirement(line) || isInvalidRequirementText(line)) continue;
    const lower = line.toLowerCase();
    if (unique.some((existing) => existing.toLowerCase() === lower)) continue;
    const cleaned = sanitizeRequirementText(line);
    if (!cleaned || isInvalidRequirementText(cleaned)) continue;
    unique.push(cleaned);
    if (unique.length >= 5) break;
  }
  return unique.map((text, index) => ({
    id: `req-${index + 1}`,
    text: text.slice(0, 240),
    priority: 10 - index,
  }));
}

function sanitizeRequirementText(text: string, maxLength = 160): string {
  let cleaned = text
    .replace(/\[[^\]]+\]\((https?:\/\/[^\s)]+)\)/gi, " ")
    .replace(/https?:\/\/[^\s]+/gi, " ")
    .replace(/\bwww\.[^\s]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";
  const splitCandidate = cleaned.split(/[.;]/).map((part) => part.trim()).find(Boolean);
  if (splitCandidate) cleaned = splitCandidate;
  cleaned = cleaned.replace(/^[^a-zA-Z0-9]+/, "").trim();
  if (!cleaned) return "";
  if (cleaned.length > maxLength) {
    const firstClause = cleaned.split(",").slice(0, 2).join(",").trim();
    cleaned = firstClause.length <= maxLength ? firstClause : `${firstClause.slice(0, maxLength - 1).trim()}…`;
  }
  return cleaned;
}

function isTechnicalRequirement(text: string): boolean {
  const lower = text.toLowerCase();
  const technicalSignal =
    /\b(api|backend|frontend|python|typescript|react|node|ml|machine learning|model|experiment|evaluation|eval|data|sql|pipeline|testing|test|deploy|infrastructure|system design|algorithm|simulation|metrics|optimization|computer vision|nlp)\b/.test(
      lower
    );
  if (!technicalSignal) return false;
  const nonTechnicalSignal =
    /\b(compensation|salary|benefits|equal opportunity|accommodation|location|start date|workday|monday|friday|40 hours|internship season|applying|enrolled|master'?s|phd|degree required|age|eligible|visa|culture|team values|customer experience|basic qualifications|preferred qualifications|communication skills|non-technical)\b/.test(
      lower
    );
  return !nonTechnicalSignal;
}

function isInvalidRequirementText(text: string): boolean {
  const cleaned = text.trim();
  if (!cleaned) return true;
  if (cleaned.length < 18) return true;
  if (/^https?:\/\//i.test(cleaned) || /^www\./i.test(cleaned)) return true;
  if (!/[a-zA-Z]/.test(cleaned)) return true;
  const lower = cleaned.toLowerCase();
  if (/\bat least\s+\d+\+?\s+year/.test(lower)) return true;
  if (/^currently enrolled\b/.test(lower)) return true;
  if (/^must be\b/.test(lower)) return true;
  if (/^are\s+\d+\s+years? of age\b/.test(lower)) return true;
  if (/^(basic|preferred)\s+qualifications\b/.test(lower)) return true;
  return false;
}
