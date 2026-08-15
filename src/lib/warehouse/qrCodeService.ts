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

const MAX_QR_PAYLOAD_LENGTH = 512;

export type CreateLocationQrInput = {
  locationUnitId: string;
  /** Scanned label value. Omit to generate a new printable QR (payload = id). */
  payload?: string;
};

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

function parseOptionalScannedPayload(
  body: Record<string, unknown>,
): string | undefined {
  if (body.payload === undefined || body.payload === null || body.payload === "") {
    return undefined;
  }
  if (typeof body.payload !== "string") {
    throw new WarehouseServiceError("Bad Request", "payload must be a string");
  }

  const payload = body.payload.trim();
  if (!payload) {
    throw new WarehouseServiceError("Bad Request", "payload is required");
  }
  if (payload.length > MAX_QR_PAYLOAD_LENGTH) {
    throw new WarehouseServiceError(
      "Bad Request",
      `payload must be at most ${MAX_QR_PAYLOAD_LENGTH} characters`,
    );
  }
  return payload;
}

export function parseCreateLocationQrInput(
  body: Record<string, unknown>,
): CreateLocationQrInput {
  const locationUnitId = parseLocationUnitId(body);
  const payload = parseOptionalScannedPayload(body);
  return payload ? { locationUnitId, payload } : { locationUnitId };
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "P2002"
  );
}

async function assertQrPayloadAvailable(
  tx: Pick<typeof prisma, "qrCode">,
  payload: string,
) {
  const existing = await tx.qrCode.findFirst({
    where: { OR: [{ id: payload }, { payload }] },
    include: {
      locationUnit: { select: { id: true } },
      item: { select: { id: true } },
    },
  });

  if (!existing) {
    return;
  }

  if (existing.locationUnit) {
    throw new WarehouseServiceError(
      "QR_CODE_DUPLICATE",
      "That QR code is already linked to a location",
      409,
    );
  }
  if (existing.item) {
    throw new WarehouseServiceError(
      "QR_CODE_DUPLICATE",
      "That QR code is already linked to an item",
      409,
    );
  }
  throw new WarehouseServiceError(
    "QR_CODE_DUPLICATE",
    "That QR code is already in use",
    409,
  );
}

export async function createLocationQrCode(
  organizationId: string,
  warehouseId: string,
  input: CreateLocationQrInput,
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
      where: { id: input.locationUnitId, warehouseId, organizationId },
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

    let qrCode;
    try {
      if (input.payload) {
        await assertQrPayloadAvailable(tx, input.payload);
        qrCode = await tx.qrCode.create({
          data: {
            organizationId,
            payload: input.payload,
            typeId: locationType.id,
          },
        });
      } else {
        const created = await tx.qrCode.create({
          data: {
            organizationId,
            payload: `pending-${crypto.randomUUID()}`,
            typeId: locationType.id,
          },
        });
        qrCode = await tx.qrCode.update({
          where: { id: created.id },
          data: { payload: created.id },
        });
      }
    } catch (error) {
      if (error instanceof WarehouseServiceError) {
        throw error;
      }
      if (isUniqueConstraintError(error)) {
        throw new WarehouseServiceError(
          "QR_CODE_DUPLICATE",
          "That QR code is already in use",
          409,
        );
      }
      throw error;
    }

    const locationUnit = await tx.locationUnit.update({
      where: { id: unit.id },
      data: { qrCodeId: qrCode.id },
      include: locationUnitInclude,
    });

    return { qrCode, locationUnit };
  });
}

export async function deleteWarehouseQrCode(
  organizationId: string,
  warehouseId: string,
  qrCodeId: string,
) {
  const unit = await prisma.locationUnit.findFirst({
    where: { qrCodeId, warehouseId, organizationId },
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
