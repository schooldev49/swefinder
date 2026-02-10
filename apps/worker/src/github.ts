import type { Env } from "./env";

export interface GitHubUserProfile {
  id: number;
  login: string;
  avatar_url: string;
  html_url: string;
  name?: string;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  description?: string;
  html_url: string;
  language?: string;
  topics?: string[];
  fork: boolean;
  updated_at: string;
  stargazers_count: number;
  default_branch: string;
}

interface GitHubTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
}

export async function exchangeCodeForToken(env: Env, code: string, redirectUri: string): Promise<GitHubTokenResponse> {
  const body = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    client_secret: env.GITHUB_CLIENT_SECRET,
    code,
    redirect_uri: redirectUri,
  });
  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
    },
    body,
  });
  if (!res.ok) {
    throw new Error("GitHub token exchange failed");
  }
  return (await res.json()) as GitHubTokenResponse;
}

export async function fetchGitHubUserProfile(token: string): Promise<GitHubUserProfile> {
  const res = await fetch("https://api.github.com/user", {
    headers: githubHeaders(token),
  });
  if (!res.ok) {
    throw new Error("Unable to fetch GitHub profile");
  }
  return (await res.json()) as GitHubUserProfile;
}

export async function fetchUserRepos(token: string): Promise<GitHubRepo[]> {
  const res = await fetch("https://api.github.com/user/repos?per_page=100&sort=updated", {
    headers: githubHeaders(token),
  });
  if (!res.ok) {
    throw new Error("Unable to fetch repositories");
  }
  return (await res.json()) as GitHubRepo[];
}

export async function fetchRepoReadme(token: string, fullName: string): Promise<string | null> {
  const res = await fetch(`https://api.github.com/repos/${fullName}/readme`, {
    headers: githubHeaders(token),
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    return null;
  }
  const data = (await res.json()) as { content: string };
  try {
    const decoded = atob(data.content.replace(/\n/g, ""));
    return decoded;
  } catch {
    return null;
  }
}

export interface GitHubTreeEntry {
  path: string;
  type: "blob" | "tree";
  size?: number;
}

export async function fetchRepoTree(token: string, fullName: string, ref?: string): Promise<GitHubTreeEntry[]> {
  const sha = encodeURIComponent(ref || "HEAD");
  const res = await fetch(`https://api.github.com/repos/${fullName}/git/trees/${sha}?recursive=1`, {
    headers: githubHeaders(token),
  });
  if (!res.ok) {
    throw new Error("Unable to fetch repository tree");
  }
  const data = (await res.json()) as { tree: GitHubTreeEntry[] };
  return data.tree || [];
}

export interface GitHubFileContent {
  path: string;
  sha: string;
  size: number;
  encoding: string;
  content: string;
}

export async function fetchRepoFileText(
  token: string,
  fullName: string,
  path: string,
  ref?: string
): Promise<{ path: string; sha: string; size: number; text: string }> {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const refParam = ref ? `?ref=${encodeURIComponent(ref)}` : "";
  const res = await fetch(`https://api.github.com/repos/${fullName}/contents/${encodedPath}${refParam}`, {
    headers: githubHeaders(token),
  });
  if (res.status === 404) {
    throw new Error("File not found");
  }
  if (!res.ok) {
    throw new Error("Unable to fetch file contents");
  }
  const data = (await res.json()) as GitHubFileContent & { decoded_content?: string };
  if (data.encoding !== "base64" || !data.content) {
    throw new Error("Unsupported file encoding");
  }
  const decoded = atob(data.content.replace(/\n/g, ""));
  return { path: data.path, sha: data.sha, size: data.size, text: decoded };
}

export interface GitHubCommitRecord {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author?: {
      name?: string;
      date?: string;
    };
  };
}

export async function fetchRepoCommits(token: string, fullName: string, perPage = 20): Promise<GitHubCommitRecord[]> {
  const clamped = Math.min(Math.max(perPage, 1), 50);
  const res = await fetch(`https://api.github.com/repos/${fullName}/commits?per_page=${clamped}`, {
    headers: githubHeaders(token),
  });
  if (!res.ok) {
    throw new Error("Unable to fetch commits");
  }
  return (await res.json()) as GitHubCommitRecord[];
}

function githubHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "evidensify-proof-agent",
  };
}
