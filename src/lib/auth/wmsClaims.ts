import "server-only";

import type { DecodedIdToken } from "firebase-admin/auth";
import { getFirebaseAdminAuth } from "@/lib/auth/firebaseAdmin";
import { ADMIN_ROLE_CODE } from "@/lib/db/defaults";

/** Firebase custom claim: warehouseId → role code. Must stay under 1000 bytes. */
export const WMS_CLAIMS_KEY = "wms";

export type WmsClaims = Record<string, string>;

export function getWmsClaims(decoded: DecodedIdToken): WmsClaims {
  const raw = decoded[WMS_CLAIMS_KEY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }

  const claims: WmsClaims = {};
  for (const [warehouseId, role] of Object.entries(raw)) {
    if (typeof role === "string") {
      claims[warehouseId] = role;
    }
  }
  return claims;
}

export function hasWarehouseAdminClaim(
  decoded: DecodedIdToken,
  warehouseId: string,
): boolean {
  return getWmsClaims(decoded)[warehouseId] === ADMIN_ROLE_CODE;
}

function sameClaims(a: WmsClaims, b: WmsClaims): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (a[key] !== b[key]) {
      return false;
    }
  }
  return true;
}

/**
 * Stamp warehouse memberships onto the Firebase user. Existing tokens keep
 * old claims until the client calls getIdToken(true).
 */
export async function syncWmsClaims(
  firebaseUid: string,
  current: WmsClaims,
  next: WmsClaims,
): Promise<boolean> {
  if (sameClaims(current, next)) {
    return false;
  }

  await getFirebaseAdminAuth().setCustomUserClaims(firebaseUid, {
    [WMS_CLAIMS_KEY]: next,
  });
  return true;
}

/**
 * Persist memberships as custom claims and mint a custom token that already
 * includes them, so signInWithCustomToken yields an ID token with `wms`.
 */
export async function issueWmsCustomToken(
  firebaseUid: string,
  claims: WmsClaims,
): Promise<string> {
  const auth = getFirebaseAdminAuth();
  await auth.setCustomUserClaims(firebaseUid, {
    [WMS_CLAIMS_KEY]: claims,
  });
  return auth.createCustomToken(firebaseUid, {
    [WMS_CLAIMS_KEY]: claims,
  });
}
