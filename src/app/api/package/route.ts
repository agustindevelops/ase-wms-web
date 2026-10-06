import { NextResponse } from "next/server";
import { recordUserActivity } from "@/lib/activity/activityService";
import { isAuthFailure, requireAdmin } from "@/lib/auth/requireAuth";
import {
  USER_ACTIVITY_ACTIONS,
  USER_ACTIVITY_ENTITY_TYPES,
} from "@/lib/db/defaults";
import { readJsonObject } from "@/lib/order/errors";
import { toPackageErrorResponse } from "@/lib/package/errors";
import {
  createPackage,
  listPackages,
  parsePackageInput,
} from "@/lib/package/packageService";

export const runtime = "nodejs";

/**
 * GET /api/package
 * Admin list of packages with items and media.
 */
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (isAuthFailure(auth)) {
    return auth.response;
  }

  try {
    const packages = await listPackages(auth.organizationId);
    return NextResponse.json({ packages });
  } catch (error) {
    return toPackageErrorResponse(error);
  }
}

/**
 * POST /api/package
 * Create a package: name, markdown description, basePriceCents,
 * items [{ itemId, quantity }], media [{ fileId } | { videoUrl }].
 */
export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (isAuthFailure(auth)) {
    return auth.response;
  }

  const parsed = await readJsonObject(request);
  if (!parsed.ok) {
    return parsed.response;
  }

  try {
    const input = parsePackageInput(parsed.value);
    const pkg = await createPackage(auth.organizationId, input);
    await recordUserActivity({
      organizationId: auth.organizationId,
      actorUserId: auth.user.id,
      action: USER_ACTIVITY_ACTIONS.PACKAGE_CREATED,
      entityType: USER_ACTIVITY_ENTITY_TYPES.PACKAGE,
      entityId: pkg.id,
      summary: `Created package "${pkg.name}"`,
    });
    return NextResponse.json({ package: pkg }, { status: 201 });
  } catch (error) {
    return toPackageErrorResponse(error);
  }
}
