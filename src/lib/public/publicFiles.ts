import "server-only";

import { prisma } from "@/lib/db/prisma";
import { getReadUrl } from "@/lib/storage/s3";

/** Fresh signature behind an eternal public file URL. Browsers must not cache the redirect past this. */
const PUBLIC_FILE_READ_EXPIRES_IN = 60 * 60;
const PUBLIC_FILE_REDIRECT_MAX_AGE = 50 * 60;

export const PUBLIC_FILE_REDIRECT_CACHE_CONTROL = `private, max-age=${PUBLIC_FILE_REDIRECT_MAX_AGE}`;

/**
 * Signed read for a package photo or video, or null when this file is not
 * published on a package. Inventory uploads and booking photos stay private.
 */
export async function publishedPackageFileReadUrl(
  organizationId: string,
  fileId: string,
): Promise<string | null> {
  const row = await prisma.packageFile.findFirst({
    where: {
      organizationId,
      fileId,
      file: { status: "uploaded" },
    },
    select: { file: { select: { s3Key: true } } },
  });
  if (!row) return null;
  return getReadUrl(row.file.s3Key, PUBLIC_FILE_READ_EXPIRES_IN);
}
