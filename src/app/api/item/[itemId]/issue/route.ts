import { NextResponse } from "next/server";
import { isAuthFailure } from "@/lib/auth/requireAuth";
import { requireItemWarehouseAdmin } from "@/lib/auth/requireWarehouseAdmin";
import { prisma } from "@/lib/db/prisma";
import {
  createItemIssue,
  parseCreateIssueBody,
} from "@/lib/issue/issueService";
import { readJsonObject, toCatalogErrorResponse } from "@/lib/item/errors";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ itemId: string }>;
};

/**
 * POST /api/item/{itemId}/issue
 * Standalone MISSING/BROKEN. Decrements owned and available.
 */
export async function POST(request: Request, context: RouteContext) {
  const { itemId } = await context.params;
  const auth = await requireItemWarehouseAdmin(request, itemId);
  if (isAuthFailure(auth)) {
    return auth.response;
  }

  const parsed = await readJsonObject(request);
  if (!parsed.ok) {
    return parsed.response;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { firebaseUid: auth.decoded.uid },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json(
        { error: "USER_NOT_PROVISIONED", message: "User is not provisioned" },
        { status: 401 },
      );
    }

    const input = parseCreateIssueBody(parsed.value);
    const issue = await createItemIssue(
      auth.organizationId,
      auth.item.id,
      user.id,
      input,
    );
    return NextResponse.json({ issue }, { status: 201 });
  } catch (error) {
    return toCatalogErrorResponse(error);
  }
}
