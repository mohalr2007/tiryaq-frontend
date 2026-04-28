import { supabase } from "@/utils/supabase/client";

function trimTrailingSlashes(value: string) {
  return value.replace(/\/+$/, "");
}

export function getDirectBackendOrigin() {
  const configuredOrigin = process.env.NEXT_PUBLIC_BACKEND_ORIGIN?.trim();
  if (configuredOrigin) {
    return trimTrailingSlashes(configuredOrigin);
  }

  return process.env.NODE_ENV === "production" ? null : "http://127.0.0.1:4000";
}

export function hasDirectBackendOrigin() {
  return Boolean(getDirectBackendOrigin());
}

type DirectBackendRequestOptions = {
  auth?: boolean;
  fallbackPath?: string;
};

export async function fetchDirectBackend(
  path: string,
  init: RequestInit = {},
  options: DirectBackendRequestOptions = {},
) {
  const origin = getDirectBackendOrigin();
  const fallbackPath = options.fallbackPath ?? path;

  if (!origin) {
    return fetch(fallbackPath, init);
  }

  const headers = new Headers(init.headers);
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  if (options.auth) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      return fetch(fallbackPath, init);
    }

    headers.set("Authorization", `Bearer ${session.access_token}`);
  }

  const requestInit: RequestInit = {
    ...init,
    headers,
    mode: "cors",
    credentials: "omit",
  };

  try {
    return await fetch(`${origin}${path}`, requestInit);
  } catch {
    return fetch(fallbackPath, init);
  }
}
