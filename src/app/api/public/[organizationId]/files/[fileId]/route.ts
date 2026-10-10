import { NextResponse } from "next/server";
import {
  findPublicOrganizationId,
  publicOrganizationNotFound,
} from "@/lib/public/publicApi";
import {
  PUBLIC_FILE_REDIRECT_CACHE_CONTROL,
  publishedPackageFileReadUrl,
} from "@/lib/public/publicFiles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ organizationId: string; fileId: string }>;
};

/**
 * GET /api/public/{organizationId}/files/{fileId}
 * Eternal URL for package media. Redirects to a new signed read so a static
 * page can keep this link after any presigned URL would have expired.
 */
export async function GET(_request: Request, context: RouteContext) {
  const { organizationId, fileId } = await context.params;
  const resolvedId = await findPublicOrganizationId(organizationId);
  if (!resolvedId) {
    return publicOrganizationNotFound();
  }

  const readUrl = await publishedPackageFileReadUrl(resolvedId, fileId);
  if (!readUrl) {
    return NextResponse.json(
      { error: "Not Found", message: "File not found" },
      { status: 404 },
    );
  }

  const response = NextResponse.redirect(readUrl, 302);
  response.headers.set("Cache-Control", PUBLIC_FILE_REDIRECT_CACHE_CONTROL);
  return response;
}
