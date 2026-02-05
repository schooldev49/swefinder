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
  description?: string;
  html_url: string;
  language?: string;
  topics?: string[];
  fork: boolean;
  updated_at: string;
  stargazers_count: number;
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

function githubHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "swefinder-proof-agent",
  };
}
