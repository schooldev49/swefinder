import type { User } from "@evidensify/types";

type PostHogClient = {
  init: (key: string, options?: Record<string, unknown>) => void;
  capture: (event: string, properties?: Record<string, unknown>) => void;
  identify: (distinctId: string, properties?: Record<string, unknown>) => void;
  reset?: () => void;
};

declare global {
  interface Window {
    posthog?: PostHogClient;
  }
}

const POSTHOG_KEY = (import.meta.env.VITE_PUBLIC_POSTHOG_KEY as string | undefined)?.trim();
const POSTHOG_HOST_RAW = (import.meta.env.VITE_PUBLIC_POSTHOG_HOST as string | undefined)?.trim();
const POSTHOG_HOST = (POSTHOG_HOST_RAW || "https://us.i.posthog.com").replace(/\/+$/, "");

let initialized = false;
let ready = false;
let pendingUser: User | null = null;

function getClient() {
  if (typeof window === "undefined") return undefined;
  return window.posthog;
}

function flushPendingUser() {
  if (!pendingUser) return;
  const client = getClient();
  if (!client || !ready) return;
  client.identify(String(pendingUser.id), {
    github_login: pendingUser.githubLogin,
    profile_slug: pendingUser.profileSlug || "",
  });
  pendingUser = null;
}

export function initPostHog() {
  if (typeof window === "undefined" || initialized || !POSTHOG_KEY) return;
  initialized = true;

  const existing = document.getElementById("posthog-js");
  if (existing) return;

  const script = document.createElement("script");
  script.id = "posthog-js";
  script.async = true;
  script.src = `${POSTHOG_HOST}/static/array.js`;
  script.onload = () => {
    const client = getClient();
    if (!client) return;
    client.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      capture_pageview: false,
      capture_pageleave: true,
      person_profiles: "identified_only",
    });
    ready = true;
    flushPendingUser();
  };
  document.head.appendChild(script);
}

export function capturePageView(path: string) {
  const client = getClient();
  if (!client || !ready) return;
  client.capture("$pageview", {
    path,
    url: typeof window !== "undefined" ? window.location.href : path,
  });
}

export function identifyPostHogUser(user: User | null | undefined) {
  if (!user) return;
  if (!ready) {
    pendingUser = user;
    return;
  }
  const client = getClient();
  if (!client) return;
  client.identify(String(user.id), {
    github_login: user.githubLogin,
    profile_slug: user.profileSlug || "",
  });
}

export function resetPostHogUser() {
  pendingUser = null;
  const client = getClient();
  if (!client || !ready) return;
  client.reset?.();
}
