import { NextResponse } from "next/server";
import {
  isAuthFailure,
  requirePrismaUser,
} from "@/lib/auth/requireAuth";

export const runtime = "nodejs";

/**
 * First-login / session smoke: upsert User after Firebase Bearer verification.
 * Use from web or ase-wms-app with Authorization: Bearer <idToken>.
 */
export async function GET(request: Request) {
  const result = await requirePrismaUser(request);
  if (isAuthFailure(result)) {
    return result.response;
  }

  return NextResponse.json({
    user: {
      id: result.user.id,
      firebaseUid: result.user.firebaseUid,
      email: result.user.email,
      role: result.user.role,
      createdAt: result.user.createdAt,
      updatedAt: result.user.updatedAt,
    },
  });
}
