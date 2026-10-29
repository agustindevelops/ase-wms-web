import "server-only";

import type { DecodedIdToken } from "firebase-admin/auth";
import { getFirebaseAdminAuth } from "@/lib/auth/firebaseAdmin";

export const ORGANIZATION_CLAIM_KEY = "organizationId";
export const ROLES_CLAIM_KEY = "roles";

export function getTokenOrganizationId(
  decoded: DecodedIdToken,
): string | null {
  const raw = decoded[ORGANIZATION_CLAIM_KEY];
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

export function getTokenRoles(decoded: DecodedIdToken): string[] {
  const raw = decoded[ROLES_CLAIM_KEY];
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (role): role is string => typeof role === "string" && Boolean(role.trim()),
  );
}

/**
 * Stamp organization and roles onto the Firebase user. Merges existing claims and
 * drops the legacy `wms` warehouse map. setCustomUserClaims replaces the
 * whole object.
 */
export async function syncOrgClaim(
  firebaseUid: string,
  currentOrganizationId: string | null,
  currentRoles: string[],
  nextOrganizationId: string,
  nextRoles: string[],
): Promise<boolean> {
  const rolesMatch =
    currentRoles.length === nextRoles.length &&
    currentRoles.every((role) => nextRoles.includes(role));
  if (currentOrganizationId === nextOrganizationId && rolesMatch) {
    return false;
  }

  const auth = getFirebaseAdminAuth();
  const user = await auth.getUser(firebaseUid);
  const existing = { ...(user.customClaims ?? {}) };
  delete existing.wms;
  existing[ORGANIZATION_CLAIM_KEY] = nextOrganizationId;
  existing[ROLES_CLAIM_KEY] = nextRoles;

  await auth.setCustomUserClaims(firebaseUid, existing);
  return true;
}

/**
 * Persist organization and role claims and mint a custom token that already
 * includes them, so signInWithCustomToken yields a ready-to-authorize ID token.
 */
export async function issueOrgCustomToken(
  firebaseUid: string,
  organizationId: string,
  roles: string[],
): Promise<string> {
  const auth = getFirebaseAdminAuth();
  const user = await auth.getUser(firebaseUid);
  const existing = { ...(user.customClaims ?? {}) };
  delete existing.wms;
  existing[ORGANIZATION_CLAIM_KEY] = organizationId;
  existing[ROLES_CLAIM_KEY] = roles;

  await auth.setCustomUserClaims(firebaseUid, existing);
  return auth.createCustomToken(firebaseUid, {
    [ORGANIZATION_CLAIM_KEY]: organizationId,
    [ROLES_CLAIM_KEY]: roles,
  });
}
