import { NextRequest, NextResponse } from "next/server";

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-length",
  "content-encoding",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);
const BACKEND_PROXY_GUARD_HEADER = "x-tiryaq-backend-proxy";
const BACKEND_PROXY_ERROR_HEADER = "x-tiryaq-backend-proxy-error";
const PROXY_FETCH_TIMEOUT_MS = 15_000;

function normalizeOrigin(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.replace(/\/+$/, "");
}

function getOriginHostname(origin: string) {
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function getBackendOrigins(request: NextRequest) {
  const requestOrigin = normalizeOrigin(request.nextUrl.origin);
  const requestHostname = requestOrigin ? getOriginHostname(requestOrigin) : "";
  const configuredOrigins = [
    normalizeOrigin(process.env.BACKEND_ORIGIN),
    normalizeOrigin(process.env.NEXT_PUBLIC_BACKEND_ORIGIN),
  ].filter((origin): origin is string => Boolean(origin));

  const deduplicatedOrigins = Array.from(new Set(configuredOrigins));
  if (deduplicatedOrigins.length === 0) {
    return process.env.NODE_ENV === "production" ? [] : ["http://127.0.0.1:4000"];
  }

  return deduplicatedOrigins.sort((left, right) => {
    const leftHostname = getOriginHostname(left);
    const rightHostname = getOriginHostname(right);

    const scoreOrigin = (origin: string, hostname: string) => {
      let score = 0;

      if (origin !== requestOrigin) {
        score += 30;
      }

      if (hostname && hostname !== requestHostname) {
        score += 25;
      }

      if (hostname.endsWith("onrender.com")) {
        score += 15;
      }

      if (hostname.endsWith("vercel.app") || hostname.endsWith("now.sh")) {
        score -= 10;
      }

      return score;
    };

    return scoreOrigin(right, rightHostname) - scoreOrigin(left, leftHostname);
  });
}

function jsonProxyError(message: string, status: number, code?: string) {
  const response = NextResponse.json({ error: message }, { status });
  if (code) {
    response.headers.set(BACKEND_PROXY_ERROR_HEADER, code);
  }
  return response;
}

export async function forwardToBackend(
  request: NextRequest,
  pathname: string,
) {
  if (request.headers.get(BACKEND_PROXY_GUARD_HEADER)) {
    return jsonProxyError(
      "Boucle détectée dans le proxy backend. Vérifiez BACKEND_ORIGIN et NEXT_PUBLIC_BACKEND_ORIGIN sur Vercel.",
      508,
      "proxy-loop",
    );
  }

  const backendOrigins = getBackendOrigins(request);
  if (backendOrigins.length === 0) {
    return jsonProxyError(
      "Le frontend pointe vers lui-même. Configurez BACKEND_ORIGIN ou NEXT_PUBLIC_BACKEND_ORIGIN avec l'URL Render du backend, pas l'URL Vercel du frontend.",
      500,
      "missing-backend-origin",
    );
  }

  const method = request.method.toUpperCase();
  const hasBody = !["GET", "HEAD"].includes(method);
  const body = hasBody ? Buffer.from(await request.arrayBuffer()) : undefined;
  let lastNetworkError: string | null = null;

  for (const backendOrigin of backendOrigins) {
    const targetUrl = new URL(`${backendOrigin}${pathname}`);
    targetUrl.search = request.nextUrl.search;

    const headers = new Headers(request.headers);
    for (const header of HOP_BY_HOP_HEADERS) {
      headers.delete(header);
    }
    headers.set(BACKEND_PROXY_GUARD_HEADER, "1");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PROXY_FETCH_TIMEOUT_MS);

    let upstream: Response;

    try {
      upstream = await fetch(targetUrl, {
        method,
        headers,
        body,
        redirect: "manual",
        signal: controller.signal,
      });
    } catch (error) {
      lastNetworkError =
        error instanceof Error
          ? error.name === "AbortError"
            ? `Le backend distant a dépassé ${Math.round(PROXY_FETCH_TIMEOUT_MS / 1000)}s`
            : error.message
          : "Le backend distant est injoignable.";
      continue;
    } finally {
      clearTimeout(timeoutId);
    }

    const proxyErrorCode = upstream.headers.get(BACKEND_PROXY_ERROR_HEADER);
    if (upstream.status === 508 || proxyErrorCode === "proxy-loop") {
      continue;
    }

    const responseHeaders = new Headers();
    upstream.headers.forEach((value, key) => {
      if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
        responseHeaders.append(key, value);
      }
    });

    if (typeof upstream.headers.getSetCookie === "function") {
      for (const cookie of upstream.headers.getSetCookie()) {
        responseHeaders.append("set-cookie", cookie);
      }
    }

    const shouldReturnBody =
      method !== "HEAD" &&
      ![204, 205, 304].includes(upstream.status);

    return new NextResponse(shouldReturnBody ? upstream.body : null, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  }

  return jsonProxyError(
    lastNetworkError
      ? `Le backend distant est injoignable: ${lastNetworkError}`
      : "Le backend distant est injoignable.",
    502,
    "backend-unreachable",
  );
}
