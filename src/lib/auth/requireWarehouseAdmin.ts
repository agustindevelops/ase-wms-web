import "server-only";

import { NextResponse } from "next/server";
import type { DecodedIdToken } from "firebase-admin/auth";
import {
  isAuthFailure,
  requireFirebaseUser,
  type AuthFailure,
  type AuthSuccess,
} from "@/lib/auth/requireAuth";
import { hasWarehouseAdminClaim } from "@/lib/auth/wmsClaims";
import { ADMIN_ROLE_CODE } from "@/lib/db/defaults";
import { prisma } from "@/lib/db/prisma";

export type WarehouseAdminContext = AuthSuccess & {
  warehouseId: string;
};

type CachedAdmin = {
  expiresAt: number;
};

const ADMIN_CACHE_TTL_MS = 30_000;
const adminCache = new Map<string, CachedAdmin>();

function forbidden(): AuthFailure {
  return {
    response: NextResponse.json(
      {
        error: "Forbidden",
        message: "Admin membership required for this warehouse",
      },
      { status: 403 },
    ),
  };
}

function cacheKey(firebaseUid: string, warehouseId: string) {
  return `${firebaseUid}:${warehouseId}`;
}

async function assertWarehouseAdmin(
  decoded: DecodedIdToken,
  warehouseId: string,
): Promise<true | AuthFailure> {
  if (hasWarehouseAdminClaim(decoded, warehouseId)) {
    return true;
  }

  const key = cacheKey(decoded.uid, warehouseId);
  const cached = adminCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return true;
  }

  const user = await prisma.user.findUnique({
    where: { firebaseUid: decoded.uid },
    include: {
      memberships: {
        where: { warehouseId },
        include: { role: true },
        take: 1,
      },
    },
  });

  const membership = user?.memberships[0];
  if (!user || !membership || membership.role.code !== ADMIN_ROLE_CODE) {
    return forbidden();
  }

  adminCache.set(key, {
    expiresAt: Date.now() + ADMIN_CACHE_TTL_MS,
  });

  return true;
}

/**
 * Warehouse-scoped ADMIN gate for `/api/warehouse/{warehouseId}/*`.
 * Prefers Firebase custom claims (`wms[warehouseId]=ADMIN`); falls back to DB.
 */
export async function requireWarehouseAdmin(
  request: Request,
  warehouseId: string,
): Promise<WarehouseAdminContext | AuthFailure> {
  if (!warehouseId) {
    return {
      response: NextResponse.json(
        { error: "Bad Request", message: "warehouseId is required" },
        { status: 400 },
      ),
    };
  }

  const auth = await requireFirebaseUser(request);
  if (isAuthFailure(auth)) {
    return auth;
  }

  const allowed = await assertWarehouseAdmin(auth.decoded, warehouseId);
  if (allowed !== true) {
    return allowed;
  }

  return {
    decoded: auth.decoded,
    warehouseId,
  };
}

/**
 * Verify the token, then authorize from claims when present so the membership
 * DB round-trip is skipped. Otherwise membership check and the read run in parallel.
 */
export async function withWarehouseAdminRead<T>(
  request: Request,
  warehouseId: string,
  load: () => Promise<T>,
): Promise<{ ok: true; data: T } | AuthFailure> {
  if (!warehouseId) {
    return {
      response: NextResponse.json(
        { error: "Bad Request", message: "warehouseId is required" },
        { status: 400 },
      ),
    };
  }

  const auth = await requireFirebaseUser(request);
  if (isAuthFailure(auth)) {
    return auth;
  }

  if (hasWarehouseAdminClaim(auth.decoded, warehouseId)) {
    return { ok: true, data: await load() };
  }

  const [allowed, data] = await Promise.all([
    assertWarehouseAdmin(auth.decoded, warehouseId),
    load().then(
      (value) => ({ ok: true as const, value }),
      (error: unknown) => ({ ok: false as const, error }),
    ),
  ]);

  if (allowed !== true) {
    return allowed;
  }

  if (!data.ok) {
    throw data.error;
  }

  return { ok: true, data: data.value };
}
