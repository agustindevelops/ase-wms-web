import { NextResponse } from "next/server";
import { OrderServiceError, toOrderErrorResponse } from "@/lib/order/errors";
import {
  bookingPhotoUrl,
  readBookingPhoto,
  storeBookingPhoto,
} from "@/lib/order/publicOrder";
import {
  corsPreflight,
  findPublicOrganizationId,
  publicOrganizationNotFound,
  withCors,
} from "@/lib/public/publicApi";

export const runtime = "nodejs";

const METHODS = "POST";

type RouteContext = {
  params: Promise<{ organizationId: string }>;
};

/**
 * POST /api/public/{organizationId}/uploads
 * Unauthenticated booking photo upload (multipart field "file": jpeg, png, webp).
 * Returns { fileUrl } to send as an order upload; the URL redirects to a fresh
 * signed read each time it is opened.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const { organizationId } = await context.params;
    const resolvedId = await findPublicOrganizationId(organizationId);
    if (!resolvedId) {
      return withCors(request, publicOrganizationNotFound(), METHODS);
    }

    const photo = await readBookingPhoto(request);
    const uploadName = await storeBookingPhoto(resolvedId, photo);
    const fileUrl = bookingPhotoUrl(request.url, resolvedId, uploadName);

    return withCors(
      request,
      NextResponse.json({ fileUrl }, { status: 201 }),
      METHODS,
    );
  } catch (error) {
    if (error instanceof OrderServiceError) {
      return withCors(request, toOrderErrorResponse(error), METHODS);
    }
    console.error("[public-upload]", error);
    return withCors(
      request,
      NextResponse.json(
        { error: "UPLOAD_ERROR", message: "Could not upload photo" },
        { status: 500 },
      ),
      METHODS,
    );
  }
}

export function OPTIONS(request: Request) {
  return corsPreflight(request, METHODS);
}
