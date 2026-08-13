import "server-only";

import { NextResponse } from "next/server";
import type { DecodedIdToken } from "firebase-admin/auth";
import type {
  Role,
  User,
  Warehouse,
  WarehouseMembership,
} from "@/generated/prisma/client";
import { getFirebaseAdminAuth } from "@/lib/auth/firebaseAdmin";
import {
  getProvisionedSession,
  SessionLookupError,
} from "@/lib/auth/sessionService";
import { getWmsClaims, syncWmsClaims } from "@/lib/auth/wmsClaims";
import { ADMIN_ROLE_CODE } from "@/lib/db/defaults";

export type AuthSuccess = {
  decoded: DecodedIdToken;
};

export type AuthFailure = {
  response: NextResponse;
};

export type UserWarehouseContext = {
  user: User;
  warehouse: Warehouse;
  role: Role;
  membership: WarehouseMembership;
};

export type PrismaAuthContext = AuthSuccess &
  UserWarehouseContext & {
    tokenRefreshRequired: boolean;
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
  result: AuthSuccess | AuthFailure | object,
): result is AuthFailure {
  return "response" in result;
}

/**
 * Verify Bearer, then load the existing Prisma User and warehouse memberships.
 * Stamps memberships onto Firebase custom claims when they are missing/stale.
 */
export async function requirePrismaUser(
  request: Request,
): Promise<PrismaAuthContext | AuthFailure> {
  const auth = await requireFirebaseUser(request);
  if (isAuthFailure(auth)) {
    return auth;
  }

  try {
    const session = await getProvisionedSession(auth.decoded.uid);
    const tokenRefreshRequired = await syncWmsClaims(
      auth.decoded.uid,
      getWmsClaims(auth.decoded),
      session.claims,
    );

    return {
      decoded: auth.decoded,
      user: session.user,
      warehouse: session.warehouse,
      role: session.role,
      membership: session.membership,
      tokenRefreshRequired,
    };
  } catch (error) {
    if (error instanceof SessionLookupError) {
      return {
        response: NextResponse.json(
          { error: error.code, message: error.message },
          { status: error.status },
        ),
      };
    }
    throw error;
  }
}

/**
 * Admin-only gate for routes that are not warehouse-scoped (e.g. /api/order).
 * MVP: the user's first warehouse membership must be ADMIN.
 */
export async function requireAdmin(
  request: Request,
): Promise<PrismaAuthContext | AuthFailure> {
  const auth = await requirePrismaUser(request);
  if (isAuthFailure(auth)) {
    return auth;
  }

  if (auth.role.code !== ADMIN_ROLE_CODE) {
    return {
      response: NextResponse.json(
        {
          error: "Forbidden",
          message: "Admin membership required",
        },
        { status: 403 },
      ),
    };
  }

  return auth;
}
