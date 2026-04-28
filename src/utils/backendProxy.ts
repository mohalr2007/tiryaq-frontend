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

function getBackendOrigin() {
  const configured = process.env.BACKEND_ORIGIN?.trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  return process.env.NODE_ENV === "production" ? null : "http://127.0.0.1:4000";
}

export async function forwardToBackend(
  request: NextRequest,
  pathname: string,
) {
  const backendOrigin = getBackendOrigin();

  if (!backendOrigin) {
    return NextResponse.json(
      { error: "BACKEND_ORIGIN n'est pas configuré côté frontend." },
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

  const upstream = await fetch(targetUrl, {
    method,
    headers,
    body,
    redirect: "manual",
  });

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

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}
