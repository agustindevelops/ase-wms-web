import "server-only";

import { NextResponse } from "next/server";
import type { DecodedIdToken } from "firebase-admin/auth";
import { getFirebaseAdminAuth } from "@/lib/auth/firebaseAdmin";
import { prisma } from "@/lib/db/prisma";
import type { User } from "@/generated/prisma/client";

export type AuthSuccess = {
  decoded: DecodedIdToken;
};

export type AuthFailure = {
  response: NextResponse;
};

/**
 * Verify Firebase Bearer token before any Prisma work.
 * Unauthenticated → 401 and no DB query.
 */
export async function requireFirebaseUser(
  request: Request,
): Promise<AuthSuccess | AuthFailure> {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return {
      response: NextResponse.json(
        { error: "Unauthorized", message: "Missing Bearer token" },
        { status: 401 },
      ),
    };
  }

  const idToken = header.slice("Bearer ".length).trim();
  if (!idToken) {
    return {
      response: NextResponse.json(
        { error: "Unauthorized", message: "Empty Bearer token" },
        { status: 401 },
      ),
    };
  }

  try {
    const decoded = await getFirebaseAdminAuth().verifyIdToken(idToken);
    return { decoded };
  } catch {
    return {
      response: NextResponse.json(
        { error: "Unauthorized", message: "Invalid or expired token" },
        { status: 401 },
      ),
    };
  }
}

export function isAuthFailure(
  result: AuthSuccess | AuthFailure,
): result is AuthFailure {
  return "response" in result;
}

/**
 * Pattern for later Features: verify Bearer → then load/upsert Prisma User.
 * Call this only after you intend to touch the DB; token check runs first.
 */
export async function requirePrismaUser(
  request: Request,
): Promise<{ decoded: DecodedIdToken; user: User } | AuthFailure> {
  const auth = await requireFirebaseUser(request);
  if (isAuthFailure(auth)) {
    return auth;
  }

  const email = auth.decoded.email;
  if (!email) {
    return {
      response: NextResponse.json(
        {
          error: "Unauthorized",
          message: "Token is missing an email claim",
        },
        { status: 401 },
      ),
    };
  }

  const user = await prisma.user.upsert({
    where: { firebaseUid: auth.decoded.uid },
    create: {
      firebaseUid: auth.decoded.uid,
      email,
    },
    update: {
      email,
    },
  });

  return { decoded: auth.decoded, user };
}
