const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) || "/api";

interface GitHubLoginOptions {
  redirectPath?: string;
  includePrivateRepos?: boolean;
}

export function buildGitHubLoginUrl(redirectPathOrOptions?: string | GitHubLoginOptions, maybeOptions?: GitHubLoginOptions) {
  let redirectPath: string | undefined;
  let options: GitHubLoginOptions | undefined;
  if (typeof redirectPathOrOptions === "string") {
    redirectPath = redirectPathOrOptions;
    options = maybeOptions;
  } else {
    options = redirectPathOrOptions;
  }

  const redirectTarget = redirectPath || options?.redirectPath || window.location.href;
  const loginUrl = new URL(`${API_BASE_URL}/auth/github/login`, window.location.origin);
  loginUrl.searchParams.set("redirect", redirectTarget);
  if (options?.includePrivateRepos) {
    loginUrl.searchParams.set("private", "1");
  }
  return loginUrl.toString();
}
