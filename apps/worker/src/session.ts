import type { Env } from "./env";
import type { SessionData } from "@swefinder/types";

const SESSION_PREFIX = "session:";
const encoder = new TextEncoder();

function getCookieName(env: Env): string {
  return env.SESSION_COOKIE_NAME || "swefinder_session";
}

function getMaxAge(env: Env): number {
  const fallback = 60 * 60 * 24 * 14; // 14 days
  if (!env.SESSION_MAX_AGE) return fallback;
  const parsed = Number(env.SESSION_MAX_AGE);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function createSession(env: Env, userId: string) {
  const sessionId = crypto.randomUUID();
  const maxAge = getMaxAge(env);
  const expiresAt = Date.now() + maxAge * 1000;
  const data: SessionData = { userId, expiresAt };
  await env.DATA_KV.put(`${SESSION_PREFIX}${sessionId}`, JSON.stringify(data), {
    expirationTtl: maxAge,
  });
  return {
    sessionId,
    cookie: serializeCookie(getCookieName(env), sessionId, {
      maxAge,
      httpOnly: true,
      sameSite: "Lax",
      secure: true,
      path: "/",
    }),
    data,
  };
}

export async function destroySession(env: Env, request: Request) {
  const sessionId = getSessionIdFromRequest(env, request);
  if (sessionId) {
    await env.DATA_KV.delete(`${SESSION_PREFIX}${sessionId}`);
  }
  return serializeCookie(getCookieName(env), "", {
    maxAge: 0,
    httpOnly: true,
    sameSite: "Lax",
    secure: true,
    path: "/",
  });
}

export async function getSession(env: Env, request: Request): Promise<SessionData | null> {
  const sessionId = getSessionIdFromRequest(env, request);
  if (!sessionId) return null;
  const raw = await env.DATA_KV.get(`${SESSION_PREFIX}${sessionId}`);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as SessionData;
    if (data.expiresAt < Date.now()) {
      await env.DATA_KV.delete(`${SESSION_PREFIX}${sessionId}`);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function getSessionIdFromRequest(env: Env, request: Request): string | null {
  const cookie = request.headers.get("Cookie");
  if (!cookie) return null;
  const cookies = parseCookies(cookie);
  return cookies[getCookieName(env)] || null;
}

type CookieOptions = {
  maxAge?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Lax" | "Strict" | "None";
  path?: string;
  domain?: string;
};

function serializeCookie(name: string, value: string, options: CookieOptions = {}): string {
  const parts = [`${name}=${value || ""}`];
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  if (options.domain) parts.push(`Domain=${options.domain}`);
  if (options.path) parts.push(`Path=${options.path}`);
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  if (options.secure) parts.push("Secure");
  if (options.httpOnly) parts.push("HttpOnly");
  return parts.join("; ");
}

function parseCookies(header: string): Record<string, string> {
  return header.split(/;\s*/).reduce<Record<string, string>>((acc, pair) => {
    const [key, ...rest] = pair.split("=");
    if (!key) return acc;
    acc[key] = rest.join("=");
    return acc;
  }, {});
}
