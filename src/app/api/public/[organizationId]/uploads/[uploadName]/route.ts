import { NextResponse } from "next/server";
import { bookingPhotoReadUrl } from "@/lib/order/publicOrder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ organizationId: string; uploadName: string }>;
};

/**
 * GET /api/public/{organizationId}/uploads/{uploadName}
 * Redirects to a short-lived signed read for a booking photo.
 */
export async function GET(_request: Request, context: RouteContext) {
  const { organizationId, uploadName } = await context.params;
  const readUrl = await bookingPhotoReadUrl(organizationId, uploadName);
  if (!readUrl) {
    return NextResponse.json(
      { error: "Not Found", message: "Photo not found" },
      { status: 404 },
    );
  }
  return NextResponse.redirect(readUrl, 302);
}
