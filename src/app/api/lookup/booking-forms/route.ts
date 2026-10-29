import { NextResponse } from "next/server";
import { isAuthFailure, requireAdmin } from "@/lib/auth/requireAuth";
import { toPackageErrorResponse } from "@/lib/package/errors";
import { listBookingForms } from "@/lib/package/packageService";

export const runtime = "nodejs";

/**
 * GET /api/lookup/booking-forms
 * Seeded BookingForm list for the package variant editor.
 */
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (isAuthFailure(auth)) {
    return auth.response;
  }

  try {
    const forms = await listBookingForms();
    return NextResponse.json({ forms });
  } catch (error) {
    return toPackageErrorResponse(error);
  }
}
