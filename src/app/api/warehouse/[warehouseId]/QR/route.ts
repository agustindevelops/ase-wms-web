import { NextResponse } from "next/server";
import { isAuthFailure } from "@/lib/auth/requireAuth";
import { requireWarehouseAdmin } from "@/lib/auth/requireWarehouseAdmin";
import {
  readJsonObject,
  toWarehouseErrorResponse,
} from "@/lib/warehouse/errors";
import {
  createLocationQrCode,
  parseCreateLocationQrInput,
} from "@/lib/warehouse/qrCodeService";

export const runtime = "nodejs";

/**
 * POST /api/warehouse/{warehouseId}/QR
 * Create a location QR (type code 1) and attach it to locationUnitId.
 * Omit payload to generate a printable code (payload = id). Pass payload to
 * bind a scanned label, rejected when that id/payload is already in use.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ warehouseId: string }> },
) {
  const { warehouseId } = await context.params;
  const auth = await requireWarehouseAdmin(request, warehouseId);
  if (isAuthFailure(auth)) {
    return auth.response;
  }

  const parsed = await readJsonObject(request);
  if (!parsed.ok) {
    return parsed.response;
  }

  try {
    const input = parseCreateLocationQrInput(parsed.value);
    const result = await createLocationQrCode(
      auth.organizationId,
      auth.warehouseId,
      input,
    );
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return toWarehouseErrorResponse(error);
  }
}
