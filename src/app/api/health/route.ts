import { NextResponse } from "next/server";
import {
  isAuthFailure,
  requireFirebaseUser,
} from "@/lib/auth/requireAuth";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

/**
 * Authenticated DB smoke check (SELECT 1).
 * Unauthenticated requests get 401 and never hit Prisma.
 */
export async function GET(request: Request) {
  const auth = await requireFirebaseUser(request);
  if (isAuthFailure(auth)) {
    return auth.response;
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      ok: true,
      uid: auth.decoded.uid,
      db: "up",
    });
  } catch (error) {
    console.error("[api/health] database check failed", error);
    return NextResponse.json(
      { ok: false, error: "Database unavailable" },
      { status: 503 },
    );
  }
}
