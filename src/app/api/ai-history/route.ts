import { NextRequest } from "next/server";
import { forwardToBackend } from "@/utils/backendProxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return forwardToBackend(request, "/api/ai-history");
}

export async function POST(request: NextRequest) {
  return forwardToBackend(request, "/api/ai-history");
}

export async function DELETE(request: NextRequest) {
  return forwardToBackend(request, "/api/ai-history");
}
