import { NextRequest } from "next/server";
import { forwardToBackend } from "@/utils/backendProxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return forwardToBackend(request, "/api/account-eligibility");
}
