import "server-only";

import { NextResponse } from "next/server";
import type { DecodedIdToken } from "firebase-admin/auth";
import type {
  Organization,
  OrganizationMembership,
  Role,
  User,
  Warehouse,
} from "@/generated/prisma/client";
import { getFirebaseAdminAuth } from "@/lib/auth/firebaseAdmin";
import {
  getTokenOrganizationId,
  syncOrgClaim,
} from "@/lib/auth/orgClaims";
import {
  getProvisionedSession,
  SessionLookupError,
} from "@/lib/auth/sessionService";
import { ADMIN_ROLE_CODE } from "@/lib/db/defaults";

export type AuthSuccess = {
  decoded: DecodedIdToken;
};

export type AuthFailure = {
  response: NextResponse;
};

export type OrgAuthContext = AuthSuccess & {
  user: User;
  organization: Organization;
  organizationId: string;
  role: Role;
  membership: OrganizationMembership;
  warehouses: Pick<Warehouse, "id" | "name">[];
  tokenRefreshRequired: boolean;
};

/** @deprecated Use OrgAuthContext. Kept as an alias during the org-tenant cutover. */
export type PrismaAuthContext = OrgAuthContext;

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
 * Verify Bearer, load Prisma user + organization membership.
 * organizationId comes from the verified token claim, matched to membership.
 */
export async function requireOrgContext(
  request: Request,
): Promise<OrgAuthContext | AuthFailure> {
  const auth = await requireFirebaseUser(request);
  if (isAuthFailure(auth)) {
    return auth;
  }

  try {
    const session = await getProvisionedSession(auth.decoded.uid);
    const tokenOrganizationId = getTokenOrganizationId(auth.decoded);

    if (
      tokenOrganizationId &&
      tokenOrganizationId !== session.organizationId
    ) {
      return {
        response: NextResponse.json(
          {
            error: "Forbidden",
            message: "Token organization does not match membership",
          },
          { status: 403 },
        ),
      };
    }

    const tokenRefreshRequired = await syncOrgClaim(
      auth.decoded.uid,
      tokenOrganizationId,
      session.organizationId,
    );

    return {
      decoded: auth.decoded,
      user: session.user,
      organization: session.organization,
      organizationId: session.organizationId,
      role: session.role,
      membership: session.membership,
      warehouses: session.warehouses,
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

/** Alias used by existing routes. */
export async function requirePrismaUser(
  request: Request,
): Promise<OrgAuthContext | AuthFailure> {
  return requireOrgContext(request);
}

/**
 * Admin-only gate. MVP: the user's organization membership must be ADMIN.
 */
export async function requireAdmin(
  request: Request,
): Promise<OrgAuthContext | AuthFailure> {
  const auth = await requireOrgContext(request);
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
