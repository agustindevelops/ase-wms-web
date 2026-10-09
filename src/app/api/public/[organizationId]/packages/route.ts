import { NextResponse } from "next/server";
import { toPackageErrorResponse } from "@/lib/package/errors";
import {
  corsPreflight,
  publicOrganizationNotFound,
  withCors,
} from "@/lib/public/publicApi";
import { getPublicPackages } from "@/lib/public/publicPackages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const METHODS = "GET";

type RouteContext = {
  params: Promise<{ organizationId: string }>;
};

/**
 * GET /api/public/{organizationId}/packages
 * Unauthenticated read for the customer site: packages with markdown
 * summary and description, basePriceCents, media (signed image URLs, video links), and items.
 * The caller must know the organization id. Cached for PUBLIC_CACHE_TIMER
 * seconds; package edits in admin clear the cache.
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const { organizationId } = await context.params;
    const packages = await getPublicPackages(organizationId);
    if (!packages) {
      return withCors(request, publicOrganizationNotFound(), METHODS);
    }
    return withCors(request, NextResponse.json({ packages }), METHODS);
  } catch (error) {
    return withCors(request, toPackageErrorResponse(error), METHODS);
  }
}

export function OPTIONS(request: Request) {
  return corsPreflight(request, METHODS);
}
