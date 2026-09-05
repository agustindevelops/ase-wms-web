import { NextResponse } from "next/server";
import { isAuthFailure, requireOrgContext } from "@/lib/auth/requireAuth";
import {
  DashboardServiceError,
  listDashboardActivity,
} from "@/lib/dashboard/dashboardService";

export const runtime = "nodejs";

/**
 * GET /api/dashboard/activity?day=YYYY-MM-DD&limit=
 * Recent user activities for the last 24 hours.
 * Optional day=YYYY-MM-DD still filters a calendar day (America/Chicago).
 * Default limit 3 for dashboard preview; raise for See all.
 */
export async function GET(request: Request) {
  const auth = await requireOrgContext(request);
  if (isAuthFailure(auth)) {
    return auth.response;
  }

  try {
    const params = new URL(request.url).searchParams;
    const day = params.get("day") ?? undefined;
    const limitRaw = params.get("limit");
    const limit = limitRaw != null ? Number(limitRaw) : undefined;
    if (limitRaw != null && (!Number.isFinite(limit) || (limit ?? 0) < 1)) {
      return NextResponse.json(
        { error: "Bad Request", message: "limit must be a positive number" },
        { status: 400 },
      );
    }

    const result = await listDashboardActivity(auth.organizationId, {
      day,
      limit,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof DashboardServiceError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: error.status },
      );
    }
    console.error("[dashboard/activity]", error);
    return NextResponse.json(
      { error: "DASHBOARD_ERROR", message: "Failed to load activity" },
      { status: 500 },
    );
  }
}
