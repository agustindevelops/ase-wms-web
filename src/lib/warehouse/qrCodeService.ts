import "server-only";

import { QR_CODE_TYPE_LOCATION } from "@/lib/db/defaults";
import { prisma } from "@/lib/db/prisma";
import { WarehouseServiceError } from "@/lib/warehouse/errors";

const locationUnitInclude = {
  type: { select: { id: true, code: true, name: true } },
  qrCode: {
    select: { id: true, payload: true, typeId: true, createdAt: true },
  },
} as const;

export function parseLocationUnitId(body: Record<string, unknown>): string {
  const locationUnitId =
    typeof body.locationUnitId === "string" ? body.locationUnitId.trim() : "";
  if (!locationUnitId) {
    throw new WarehouseServiceError(
      "Bad Request",
      "locationUnitId is required",
    );
  }
  return locationUnitId;
}

export async function createLocationQrCode(
  warehouseId: string,
  locationUnitId: string,
) {
  const locationType = await prisma.qrCodeType.findUnique({
    where: { code: QR_CODE_TYPE_LOCATION },
  });
  if (!locationType) {
    throw new WarehouseServiceError(
      "QR_CODE_TYPE_NOT_SEEDED",
      "QR code type for location units is not seeded",
      500,
    );
  }

  return prisma.$transaction(async (tx) => {
    const unit = await tx.locationUnit.findFirst({
      where: { id: locationUnitId, warehouseId },
    });

    if (!unit) {
      throw new WarehouseServiceError(
        "LOCATION_UNIT_NOT_FOUND",
        "Location unit not found in this warehouse",
        404,
      );
    }

    if (unit.qrCodeId) {
      throw new WarehouseServiceError(
        "QR_CODE_EXISTS",
        "Location unit already has a QR code",
        409,
      );
    }

    const qrCode = await tx.qrCode.create({
      data: {
        payload: `pending-${crypto.randomUUID()}`,
        typeId: locationType.id,
      },
    });

    const withPayload = await tx.qrCode.update({
      where: { id: qrCode.id },
      data: { payload: qrCode.id },
    });

    const locationUnit = await tx.locationUnit.update({
      where: { id: unit.id },
      data: { qrCodeId: qrCode.id },
      include: locationUnitInclude,
    });

    return { qrCode: withPayload, locationUnit };
  });
}

export async function deleteWarehouseQrCode(
  warehouseId: string,
  qrCodeId: string,
) {
  const unit = await prisma.locationUnit.findFirst({
    where: { qrCodeId, warehouseId },
  });

  if (!unit) {
    throw new WarehouseServiceError(
      "QR_CODE_NOT_FOUND",
      "QR code not found on a location unit in this warehouse",
      404,
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.locationUnit.update({
      where: { id: unit.id },
      data: { qrCodeId: null },
    });
    await tx.qrCode.delete({ where: { id: qrCodeId } });
  });

  return { id: qrCodeId, deleted: true };
}
