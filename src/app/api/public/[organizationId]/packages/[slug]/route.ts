import { NextResponse } from "next/server";
import { toPackageErrorResponse } from "@/lib/package/errors";
import {
  corsPreflight,
  publicOrganizationNotFound,
  withCors,
} from "@/lib/public/publicApi";
import {
  getPublicPackageBySlug,
  withAbsoluteMediaUrls,
} from "@/lib/public/publicPackages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const METHODS = "GET";

type RouteContext = {
  params: Promise<{ organizationId: string; slug: string }>;
};

/**
 * GET /api/public/{organizationId}/packages/{slug}
 * Unauthenticated read of one package by its customer-site URL slug, same
 * shape as an entry in GET /packages. 404 when the organization or slug is
 * unknown. Served from the same cache as the package list.
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const { organizationId, slug } = await context.params;
    const pkg = await getPublicPackageBySlug(organizationId, slug);
    if (pkg === undefined) {
      return withCors(request, publicOrganizationNotFound(), METHODS);
    }
    if (pkg === null) {
      return withCors(
        request,
        NextResponse.json(
          { error: "Not Found", message: "Package not found" },
          { status: 404 },
        ),
        METHODS,
      );
    }
    return withCors(
      request,
      NextResponse.json({ package: withAbsoluteMediaUrls(request, pkg) }),
      METHODS,
    );
  } catch (error) {
    return withCors(request, toPackageErrorResponse(error), METHODS);
  }
}

export function OPTIONS(request: Request) {
  return corsPreflight(request, METHODS);
}
