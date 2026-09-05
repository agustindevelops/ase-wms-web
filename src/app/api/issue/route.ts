import { NextResponse } from "next/server";
import { isAuthFailure, requireAdmin } from "@/lib/auth/requireAuth";
import { listIssues, parseIssueTypeFilter } from "@/lib/issue/issueService";
import { toCatalogErrorResponse } from "@/lib/item/errors";

export const runtime = "nodejs";

/**
 * GET /api/issue?type=MISSING|BROKEN
 * Org-scoped missing/broken reports. Optional type (repeatable or comma-separated).
 */
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (isAuthFailure(auth)) {
    return auth.response;
  }

  try {
    const types = parseIssueTypeFilter(new URL(request.url).searchParams);
    const issues = await listIssues(auth.organizationId, types);
    return NextResponse.json({ issues });
  } catch (error) {
    return toCatalogErrorResponse(error);
  }
}
