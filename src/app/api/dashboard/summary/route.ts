import { NextResponse } from "next/server";
import { isAuthFailure, requireOrgContext } from "@/lib/auth/requireAuth";
import {
  DashboardServiceError,
  getDashboardSummary,
} from "@/lib/dashboard/dashboardService";

export const runtime = "nodejs";

/**
 * GET /api/dashboard/summary
 * Org-scoped cards: total inventory, upcoming events this month,
 * issues this month, changes in the last 24 hours.
 */
export async function GET(request: Request) {
  const auth = await requireOrgContext(request);
  if (isAuthFailure(auth)) {
    return auth.response;
  }

  try {
    const summary = await getDashboardSummary(auth.organizationId);
    return NextResponse.json({ summary });
  } catch (error) {
    if (error instanceof DashboardServiceError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: error.status },
      );
    }
    console.error("[dashboard/summary]", error);
    return NextResponse.json(
      { error: "DASHBOARD_ERROR", message: "Failed to load dashboard summary" },
      { status: 500 },
    );
  }
}
