import "server-only";

import type { DecodedIdToken } from "firebase-admin/auth";
import { getFirebaseAdminAuth } from "@/lib/auth/firebaseAdmin";

export const ORGANIZATION_CLAIM_KEY = "organizationId";

export function getTokenOrganizationId(
  decoded: DecodedIdToken,
): string | null {
  const raw = decoded[ORGANIZATION_CLAIM_KEY];
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

/**
 * Stamp organizationId onto the Firebase user. Merges existing claims and
 * drops the legacy `wms` warehouse map. setCustomUserClaims replaces the
 * whole object.
 */
export async function syncOrgClaim(
  firebaseUid: string,
  currentOrganizationId: string | null,
  nextOrganizationId: string,
): Promise<boolean> {
  if (currentOrganizationId === nextOrganizationId) {
    return false;
  }

  const auth = getFirebaseAdminAuth();
  const user = await auth.getUser(firebaseUid);
  const existing = { ...(user.customClaims ?? {}) };
  delete existing.wms;
  existing[ORGANIZATION_CLAIM_KEY] = nextOrganizationId;

  await auth.setCustomUserClaims(firebaseUid, existing);
  return true;
}

/**
 * Persist organizationId as a custom claim and mint a custom token that
 * already includes it, so signInWithCustomToken yields an ID token with
 * organizationId.
 */
export async function issueOrgCustomToken(
  firebaseUid: string,
  organizationId: string,
): Promise<string> {
  const auth = getFirebaseAdminAuth();
  const user = await auth.getUser(firebaseUid);
  const existing = { ...(user.customClaims ?? {}) };
  delete existing.wms;
  existing[ORGANIZATION_CLAIM_KEY] = organizationId;

  await auth.setCustomUserClaims(firebaseUid, existing);
  return auth.createCustomToken(firebaseUid, {
    [ORGANIZATION_CLAIM_KEY]: organizationId,
  });
}
