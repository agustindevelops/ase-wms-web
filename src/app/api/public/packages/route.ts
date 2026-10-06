import { NextResponse } from "next/server";
import { toPackageErrorResponse } from "@/lib/package/errors";
import { listPackages, toPublicPackage } from "@/lib/package/packageService";
import {
  corsPreflight,
  getPublicOrganizationId,
  publicOrganizationMissing,
  withCors,
} from "@/lib/public/publicApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const METHODS = "GET";

/**
 * GET /api/public/packages
 * Unauthenticated read for the customer site: packages with markdown
 * description, basePriceCents, media (signed image URLs, video links), and items.
 */
export async function GET(request: Request) {
  try {
    const organizationId = await getPublicOrganizationId();
    if (!organizationId) {
      return withCors(request, publicOrganizationMissing(), METHODS);
    }
    const packages = await listPackages(organizationId);
    return withCors(
      request,
      NextResponse.json({ packages: packages.map(toPublicPackage) }),
      METHODS,
    );
  } catch (error) {
    return withCors(request, toPackageErrorResponse(error), METHODS);
  }
}

export function OPTIONS(request: Request) {
  return corsPreflight(request, METHODS);
}
