import type { Env } from "./env";

export function jsonResponse<T>(data: T, init?: ResponseInit): Response {
  const body = JSON.stringify({ success: true, data });
  return new Response(body, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

export function errorResponse(message: string, status = 400, init?: ResponseInit): Response {
  const body = JSON.stringify({ success: false, error: message });
  return new Response(body, {
    status,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

export function getAllowedOrigin(request: Request, env: Env): string {
  return env.FRONTEND_BASE_URL || new URL(request.url).origin;
}

export function withCors(response: Response, origin: string, includeCredentials = true): Response {
  response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set("Vary", "Origin");
  if (includeCredentials) {
    response.headers.set("Access-Control-Allow-Credentials", "true");
  }
  return response;
}

export function handleOptions(request: Request, env: Env): Response {
  const origin = getAllowedOrigin(request, env);
  const headers = new Headers({
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": request.headers.get("Access-Control-Request-Headers") || "*",
    "Access-Control-Allow-Methods": request.headers.get("Access-Control-Request-Method") || "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
  });
  return new Response(null, { status: 204, headers });
}

export async function parseJsonBody<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch (error) {
    throw new Error("Invalid JSON body");
  }
}
