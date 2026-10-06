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
  deletePackage,
  getPackage,
  parsePackageInput,
  updatePackage,
} from "@/lib/package/packageService";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ packageId: string }>;
};

/**
 * GET /api/package/{packageId}
 */
export async function GET(request: Request, context: RouteContext) {
  const auth = await requireAdmin(request);
  if (isAuthFailure(auth)) {
    return auth.response;
  }

  try {
    const { packageId } = await context.params;
    const pkg = await getPackage(auth.organizationId, packageId);
    return NextResponse.json({ package: pkg });
  } catch (error) {
    return toPackageErrorResponse(error);
  }
}

/**
 * PUT /api/package/{packageId}
 * Replace the package: same body as POST /api/package.
 */
export async function PUT(request: Request, context: RouteContext) {
  const auth = await requireAdmin(request);
  if (isAuthFailure(auth)) {
    return auth.response;
  }

  const parsed = await readJsonObject(request);
  if (!parsed.ok) {
    return parsed.response;
  }

  try {
    const { packageId } = await context.params;
    const input = parsePackageInput(parsed.value);
    const pkg = await updatePackage(auth.organizationId, packageId, input);
    await recordUserActivity({
      organizationId: auth.organizationId,
      actorUserId: auth.user.id,
      action: USER_ACTIVITY_ACTIONS.PACKAGE_UPDATED,
      entityType: USER_ACTIVITY_ENTITY_TYPES.PACKAGE,
      entityId: pkg.id,
      summary: `Updated package "${pkg.name}"`,
    });
    return NextResponse.json({ package: pkg });
  } catch (error) {
    return toPackageErrorResponse(error);
  }
}

/**
 * DELETE /api/package/{packageId}
 * Orders created from it keep their items; their package reference is cleared.
 */
export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requireAdmin(request);
  if (isAuthFailure(auth)) {
    return auth.response;
  }

  try {
    const { packageId } = await context.params;
    const removed = await deletePackage(auth.organizationId, packageId);
    await recordUserActivity({
      organizationId: auth.organizationId,
      actorUserId: auth.user.id,
      action: USER_ACTIVITY_ACTIONS.PACKAGE_DELETED,
      entityType: USER_ACTIVITY_ENTITY_TYPES.PACKAGE,
      entityId: removed.id,
      summary: `Deleted package "${removed.name}"`,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toPackageErrorResponse(error);
  }
}
