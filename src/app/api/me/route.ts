import { NextResponse } from "next/server";
import {
  isAuthFailure,
  requirePrismaUser,
} from "@/lib/auth/requireAuth";

export const runtime = "nodejs";

/**
 * First-login / session smoke: after Firebase Bearer verification, upsert the
 * Prisma User, the default warehouse (if missing), and ADMIN membership.
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
      createdAt: result.user.createdAt,
      updatedAt: result.user.updatedAt,
    },
    warehouse: {
      id: result.warehouse.id,
      name: result.warehouse.name,
    },
    role: {
      code: result.role.code,
      name: result.role.name,
    },
  });
}
