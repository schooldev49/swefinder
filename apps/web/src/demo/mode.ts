/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

const DEMO_STORAGE_KEY = "proofcraft-demo-mode";

function hasQueryDemo(search: string) {
  const params = new URLSearchParams(search);
  return params.has("demo");
}

export function isDemoMode(): boolean {
  if (typeof window === "undefined") return false;
  if (hasQueryDemo(window.location.search)) {
    try {
      window.localStorage?.setItem(DEMO_STORAGE_KEY, "true");
    } catch {
      // ignore storage errors
    }
    return true;
  }
  try {
    const stored = window.localStorage?.getItem(DEMO_STORAGE_KEY);
    if (stored === null) {
      return true;
    }
    return stored === "true";
  } catch {
    return true;
  }
}

export function exitDemoMode() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage?.removeItem(DEMO_STORAGE_KEY);
  } catch {
    // ignore
  }
  const url = new URL(window.location.href);
  url.searchParams.delete("demo");
  window.location.href = url.pathname;
}

export function useDemoMode() {
  const location = useLocation();
  const [demo, setDemo] = useState(() => isDemoMode());

  useEffect(() => {
    setDemo(isDemoMode());
  }, [location.search]);

  return demo;
}

export function setDemoPreference(enabled: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage?.setItem(DEMO_STORAGE_KEY, enabled ? "true" : "false");
  } catch {
    // ignore
  }
}
