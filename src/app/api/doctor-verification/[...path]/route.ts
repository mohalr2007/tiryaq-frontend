import { NextRequest } from "next/server";
import { forwardToBackend } from "@/utils/backendProxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function resolvePath(context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return `/api/doctor-verification/${path.join("/")}`;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  return forwardToBackend(request, await resolvePath(context));
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  return forwardToBackend(request, await resolvePath(context));
}
