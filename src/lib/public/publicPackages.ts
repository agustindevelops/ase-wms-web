import "server-only";

import { revalidateTag } from "next/cache";
import { listPackages, toPublicPackage } from "@/lib/package/packageService";
import { findPublicOrganizationId } from "@/lib/public/publicApi";
import { publicCached } from "@/lib/public/publicCache";
import { ETERNAL_READ_URL } from "@/lib/storage/fileService";

const PUBLIC_PACKAGES_TAG = "public-packages";

/** Customer-site package list, or null when the organization does not exist. */
export const getPublicPackages = publicCached(
  async (organizationId: string) => {
    const resolvedId = await findPublicOrganizationId(organizationId);
    if (!resolvedId) return null;
    const packages = await listPackages(resolvedId, {
      mediaExpiresIn: ETERNAL_READ_URL,
    });
    return packages.map(toPublicPackage);
  },
  // Bump the version when the public package shape changes so stale entries aren't served.
  ["public-packages", "v3"],
  [PUBLIC_PACKAGES_TAG],
);

export type PublicPackage = ReturnType<typeof toPublicPackage>;

/**
 * One package by its slug. `undefined` when the organization does not exist,
 * `null` when it has no package with that slug.
 */
export async function getPublicPackageBySlug(
  organizationId: string,
  slug: string,
): Promise<PublicPackage | null | undefined> {
  const packages = await getPublicPackages(organizationId);
  if (!packages) return undefined;
  return packages.find((pkg) => pkg.slug === slug) ?? null;
}

type WithMedia = { media: Array<{ url: string }> };

/**
 * Eternal media links are stored as app paths. The browser has to receive an
 * absolute URL on this host, because the customer site is a different origin.
 */
export function withAbsoluteMediaUrls<T extends WithMedia>(
  request: Request,
  value: T,
): T {
  return {
    ...value,
    media: value.media.map((item) => ({
      ...item,
      url: item.url.startsWith("/")
        ? new URL(item.url, request.url).toString()
        : item.url,
    })),
  };
}

/** Call after any package change so the customer site sees it right away. */
export function revalidatePublicPackages(): void {
  revalidateTag(PUBLIC_PACKAGES_TAG);
}
