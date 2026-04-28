import { NextRequest, NextResponse } from "next/server";

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

function normalizeOrigin(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.replace(/\/+$/, "");
}

function getBackendOrigin(request: NextRequest) {
  const requestOrigin = normalizeOrigin(request.nextUrl.origin);
  const configuredOrigins = [
    normalizeOrigin(process.env.BACKEND_ORIGIN),
    normalizeOrigin(process.env.NEXT_PUBLIC_BACKEND_ORIGIN),
  ].filter((origin): origin is string => Boolean(origin));

  const safeOrigin = configuredOrigins.find((origin) => origin !== requestOrigin);
  if (safeOrigin) {
    return safeOrigin;
  }

  if (configuredOrigins.length > 0) {
    return null;
  }

  return process.env.NODE_ENV === "production" ? null : "http://127.0.0.1:4000";
}

export async function forwardToBackend(
  request: NextRequest,
  pathname: string,
) {
  const backendOrigin = getBackendOrigin(request);

  if (!backendOrigin) {
    return NextResponse.json(
      {
        error:
          "Le frontend pointe vers lui-même. Configurez BACKEND_ORIGIN ou NEXT_PUBLIC_BACKEND_ORIGIN avec l'URL Render du backend, pas l'URL Vercel du frontend.",
      },
      { status: 500 },
    );
  }

  const targetUrl = new URL(`${backendOrigin}${pathname}`);
  targetUrl.search = request.nextUrl.search;

  const headers = new Headers(request.headers);
  for (const header of HOP_BY_HOP_HEADERS) {
    headers.delete(header);
  }

  const method = request.method.toUpperCase();
  const hasBody = !["GET", "HEAD"].includes(method);
  const body = hasBody ? Buffer.from(await request.arrayBuffer()) : undefined;

  let upstream: Response;

  try {
    upstream = await fetch(targetUrl, {
      method,
      headers,
      body,
      redirect: "manual",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `Le backend distant est injoignable: ${error.message}`
            : "Le backend distant est injoignable.",
      },
      { status: 502 },
    );
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
    request.method.toUpperCase() !== "HEAD" &&
    ![204, 205, 304].includes(upstream.status);

  const responseBody = shouldReturnBody
    ? new Uint8Array(await upstream.arrayBuffer())
    : null;

  return new NextResponse(responseBody, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}
