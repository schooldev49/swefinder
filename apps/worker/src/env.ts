export interface Env {
  DATA_KV: KVNamespace;
  SESSION_SECRET: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  FRONTEND_BASE_URL?: string;
  SESSION_COOKIE_NAME?: string;
  SESSION_MAX_AGE?: string;
}
