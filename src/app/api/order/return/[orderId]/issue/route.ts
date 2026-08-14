import { NextResponse } from "next/server";
import { isAuthFailure, requireAdmin } from "@/lib/auth/requireAuth";
import { readJsonObject, toOrderErrorResponse } from "@/lib/order/errors";
import {
  parseIssueBody,
  reportReturnIssue,
} from "@/lib/order/fulfillmentService";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ orderId: string }>;
};

/**
 * POST /api/order/return/{orderId}/issue
 * Record MISSING/BROKEN. Decrements owned qty only; never restores available.
 */
export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAdmin(request);
  if (isAuthFailure(auth)) {
    return auth.response;
  }

  const parsed = await readJsonObject(request);
  if (!parsed.ok) {
    return parsed.response;
  }

  try {
    const { orderId } = await context.params;
    const input = parseIssueBody(parsed.value);
    const order = await reportReturnIssue(orderId, auth.user.id, input);
    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    return toOrderErrorResponse(error);
  }
}
