const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) || "/api";

export function buildGitHubLoginUrl(redirectPath?: string) {
  const redirectTarget = redirectPath || window.location.href;
  const loginUrl = new URL(`${API_BASE_URL}/auth/github/login`, window.location.origin);
  loginUrl.searchParams.set("redirect", redirectTarget);
  return loginUrl.toString();
}
