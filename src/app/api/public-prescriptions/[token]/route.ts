import { NextRequest } from "next/server";
import { forwardToBackend } from "@/utils/backendProxy";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  return forwardToBackend(request, `/api/public-prescriptions/${token}`);
}
