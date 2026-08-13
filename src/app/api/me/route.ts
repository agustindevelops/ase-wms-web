import { NextResponse } from "next/server";
import {
  isAuthFailure,
  requirePrismaUser,
} from "@/lib/auth/requireAuth";
import { toSessionJson } from "@/lib/auth/sessionService";

export const runtime = "nodejs";

/**
 * Session context for an already-signed-in user.
 * Use from web or ase-wms-app with Authorization: Bearer <idToken>.
 */
export async function GET(request: Request) {
  const result = await requirePrismaUser(request);
  if (isAuthFailure(result)) {
    return result.response;
  }

  return NextResponse.json({
    ...toSessionJson(result),
    tokenRefreshRequired: result.tokenRefreshRequired,
  });
}
