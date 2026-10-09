import "server-only";

import { revalidateTag } from "next/cache";
import { listPackages, toPublicPackage } from "@/lib/package/packageService";
import { findPublicOrganizationId } from "@/lib/public/publicApi";
import { publicCached } from "@/lib/public/publicCache";

const PUBLIC_PACKAGES_TAG = "public-packages";

/** Customer-site package list, or null when the organization does not exist. */
export const getPublicPackages = publicCached(
  async (organizationId: string) => {
    const resolvedId = await findPublicOrganizationId(organizationId);
    if (!resolvedId) return null;
    const packages = await listPackages(resolvedId);
    return packages.map(toPublicPackage);
  },
  ["public-packages"],
  [PUBLIC_PACKAGES_TAG],
);

/** Call after any package change so the customer site sees it right away. */
export function revalidatePublicPackages(): void {
  revalidateTag(PUBLIC_PACKAGES_TAG);
}
