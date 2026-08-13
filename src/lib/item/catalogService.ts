import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import {
  QR_CODE_TYPE_ITEM,
  QR_CODE_TYPE_LOCATION,
} from "@/lib/db/defaults";
import { prisma } from "@/lib/db/prisma";
import { CatalogServiceError } from "@/lib/item/errors";

const itemInclude = {
  category: { select: { id: true, code: true, name: true } },
  qrCode: {
    select: { id: true, payload: true, typeId: true, createdAt: true },
  },
  locationUnit: {
    select: {
      id: true,
      name: true,
      label: true,
      warehouseId: true,
      qrCodeId: true,
    },
  },
  files: {
    select: {
      id: true,
      publicUrl: true,
      status: true,
      sortOrder: true,
      contentType: true,
    },
    orderBy: { sortOrder: "asc" as const },
  },
} satisfies Prisma.ItemInclude;

export type ItemRecord = Prisma.ItemGetPayload<{
  include: typeof itemInclude;
}>;

export type CatalogCreateInput = {
  warehouseId: string;
  name: string;
  quantity: number;
  /** Verified file ids in display order (sortOrder 0..n-1). At least one required. */
  photoFileIds: string[];
  categoryId: string | null;
  material: string | null;
};

function asOptionalString(
  value: unknown,
  field: string,
): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value !== "string") {
    throw new CatalogServiceError("Bad Request", `${field} must be a string`);
  }
  return value.trim() || null;
}

function parsePhotoFileIds(body: Record<string, unknown>): string[] {
  if (Array.isArray(body.photoFileIds)) {
    const ids = body.photoFileIds
      .filter((id): id is string => typeof id === "string")
      .map((id) => id.trim())
      .filter(Boolean);
    if (ids.length === 0) {
      throw new CatalogServiceError(
        "Bad Request",
        "photoFileIds must include at least one verified file id",
      );
    }
    return [...new Set(ids)];
  }

  // Backward-compatible single-photo field.
  const photoFileId =
    typeof body.photoFileId === "string" ? body.photoFileId.trim() : "";
  if (!photoFileId) {
    throw new CatalogServiceError(
      "Bad Request",
      "photoFileIds (or photoFileId) is required",
    );
  }
  return [photoFileId];
}

export function parseCatalogCreateInput(
  body: Record<string, unknown>,
): CatalogCreateInput {
  const warehouseId =
    typeof body.warehouseId === "string" ? body.warehouseId.trim() : "";
  if (!warehouseId) {
    throw new CatalogServiceError("Bad Request", "warehouseId is required");
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    throw new CatalogServiceError("Bad Request", "name is required");
  }

  const quantityRaw = body.quantity;
  const quantity =
    typeof quantityRaw === "number"
      ? quantityRaw
      : typeof quantityRaw === "string"
        ? Number(quantityRaw)
        : Number.NaN;

  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new CatalogServiceError(
      "Bad Request",
      "quantity must be an integer greater than 0",
    );
  }

  return {
    warehouseId,
    name,
    quantity,
    photoFileIds: parsePhotoFileIds(body),
    categoryId: asOptionalString(body.categoryId, "categoryId"),
    material: asOptionalString(body.material, "material"),
  };
}

export async function listItemCategories() {
  return prisma.itemCategory.findMany({
    orderBy: { name: "asc" },
    select: { id: true, code: true, name: true },
  });
}

export async function createCatalogItem(
  input: CatalogCreateInput,
): Promise<ItemRecord> {
  if (input.categoryId) {
    const category = await prisma.itemCategory.findUnique({
      where: { id: input.categoryId },
    });
    if (!category) {
      throw new CatalogServiceError(
        "CATEGORY_NOT_FOUND",
        "categoryId was not found",
        404,
      );
    }
  }

  return prisma.$transaction(async (tx) => {
    const files = await tx.file.findMany({
      where: { id: { in: input.photoFileIds } },
    });

    if (files.length !== input.photoFileIds.length) {
      throw new CatalogServiceError(
        "FILE_NOT_FOUND",
        "One or more photoFileIds were not found",
        404,
      );
    }

    const byId = new Map(files.map((file) => [file.id, file]));
    for (const fileId of input.photoFileIds) {
      const file = byId.get(fileId);
      if (!file) {
        throw new CatalogServiceError(
          "FILE_NOT_FOUND",
          "One or more photoFileIds were not found",
          404,
        );
      }
      if (file.status !== "uploaded") {
        throw new CatalogServiceError(
          "FILE_NOT_VERIFIED",
          "Photo only attaches after verified file upload",
          400,
        );
      }
      if (file.itemId) {
        throw new CatalogServiceError(
          "FILE_ALREADY_ATTACHED",
          "Photo file is already attached to an item",
          409,
        );
      }
    }

    const item = await tx.item.create({
      data: {
        warehouseId: input.warehouseId,
        name: input.name,
        quantityOwned: input.quantity,
        quantityAvailable: input.quantity,
        categoryId: input.categoryId,
        material: input.material,
      },
    });

    await Promise.all(
      input.photoFileIds.map((fileId, index) =>
        tx.file.update({
          where: { id: fileId },
          data: { itemId: item.id, sortOrder: index },
        }),
      ),
    );

    return tx.item.findUniqueOrThrow({
      where: { id: item.id },
      include: itemInclude,
    });
  });
}

export async function createItemQrCode(warehouseId: string, itemId: string) {
  const itemType = await prisma.qrCodeType.findUnique({
    where: { code: QR_CODE_TYPE_ITEM },
  });
  if (!itemType) {
    throw new CatalogServiceError(
      "QR_CODE_TYPE_NOT_SEEDED",
      "QR code type for items is not seeded",
      500,
    );
  }

  return prisma.$transaction(async (tx) => {
    const item = await tx.item.findFirst({
      where: { id: itemId, warehouseId },
    });

    if (!item) {
      throw new CatalogServiceError(
        "ITEM_NOT_FOUND",
        "Item not found in this warehouse",
        404,
      );
    }

    if (item.qrCodeId) {
      throw new CatalogServiceError(
        "QR_CODE_EXISTS",
        "Item already has a QR code",
        409,
      );
    }

    const qrCode = await tx.qrCode.create({
      data: {
        payload: `pending-${crypto.randomUUID()}`,
        typeId: itemType.id,
      },
    });

    const withPayload = await tx.qrCode.update({
      where: { id: qrCode.id },
      data: { payload: qrCode.id },
    });

    const updated = await tx.item.update({
      where: { id: item.id },
      data: { qrCodeId: qrCode.id },
      include: itemInclude,
    });

    return { qrCode: withPayload, item: updated };
  });
}

export async function deleteItemQrCode(warehouseId: string, qrCodeId: string) {
  const itemType = await prisma.qrCodeType.findUnique({
    where: { code: QR_CODE_TYPE_ITEM },
  });
  if (!itemType) {
    throw new CatalogServiceError(
      "QR_CODE_TYPE_NOT_SEEDED",
      "QR code type for items is not seeded",
      500,
    );
  }

  const item = await prisma.item.findFirst({
    where: { qrCodeId, warehouseId },
    include: { qrCode: true },
  });

  if (!item?.qrCode) {
    throw new CatalogServiceError(
      "QR_CODE_NOT_FOUND",
      "QR code not found on an item in this warehouse",
      404,
    );
  }

  if (item.qrCode.typeId !== itemType.id) {
    throw new CatalogServiceError(
      "QR_CODE_WRONG_TYPE",
      "Only item QR codes (type 0) can be deleted here",
      404,
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.item.update({
      where: { id: item.id },
      data: { qrCodeId: null },
    });
    await tx.qrCode.delete({ where: { id: qrCodeId } });
  });

  return { id: qrCodeId, deleted: true as const };
}

export async function resolveWarehouseQr(warehouseId: string, idOrPayload: string) {
  const qrCode = await prisma.qrCode.findFirst({
    where: {
      OR: [{ id: idOrPayload }, { payload: idOrPayload }],
    },
    include: {
      type: { select: { id: true, code: true, name: true } },
      locationUnit: {
        select: {
          id: true,
          warehouseId: true,
          name: true,
          label: true,
          qrCodeId: true,
        },
      },
      item: {
        select: {
          id: true,
          warehouseId: true,
          name: true,
          qrCodeId: true,
          locationUnitId: true,
          locationUnit: {
            select: { id: true, name: true, label: true },
          },
        },
      },
    },
  });

  if (!qrCode) {
    throw new CatalogServiceError(
      "QR_CODE_NOT_FOUND",
      "QR code not found",
      404,
    );
  }

  const locationUnit =
    qrCode.locationUnit?.warehouseId === warehouseId
      ? qrCode.locationUnit
      : null;
  const item =
    qrCode.item?.warehouseId === warehouseId ? qrCode.item : null;

  if (
    qrCode.type.code === QR_CODE_TYPE_LOCATION &&
    qrCode.locationUnit &&
    !locationUnit
  ) {
    throw new CatalogServiceError(
      "QR_CODE_WRONG_WAREHOUSE",
      "QR code does not belong to this warehouse",
      404,
    );
  }

  if (qrCode.type.code === QR_CODE_TYPE_ITEM && qrCode.item && !item) {
    throw new CatalogServiceError(
      "QR_CODE_WRONG_WAREHOUSE",
      "QR code does not belong to this warehouse",
      404,
    );
  }

  return {
    qrCode: {
      id: qrCode.id,
      payload: qrCode.payload,
      typeId: qrCode.typeId,
      createdAt: qrCode.createdAt,
      updatedAt: qrCode.updatedAt,
    },
    typeCode: qrCode.type.code,
    locationUnit,
    item,
  };
}

export async function bindItemToLocationUnit(
  warehouseId: string,
  locationUnitId: string,
  itemId: string,
): Promise<ItemRecord> {
  const [locationUnit, item] = await Promise.all([
    prisma.locationUnit.findFirst({
      where: { id: locationUnitId, warehouseId },
    }),
    prisma.item.findFirst({
      where: { id: itemId, warehouseId },
    }),
  ]);

  if (!locationUnit) {
    throw new CatalogServiceError(
      "LOCATION_UNIT_NOT_FOUND",
      "Location unit not found in this warehouse",
      404,
    );
  }

  if (!item) {
    throw new CatalogServiceError(
      "ITEM_NOT_FOUND",
      "Item not found in this warehouse",
      404,
    );
  }

  return prisma.item.update({
    where: { id: item.id },
    data: { locationUnitId: locationUnit.id },
    include: itemInclude,
  });
}

export type WarehouseItemLocationFilter = "none" | "set" | "all";

export function parseWarehouseItemLocationFilter(
  value: string | null,
): WarehouseItemLocationFilter {
  if (value === null || value === "" || value === "all") {
    return "all";
  }
  if (value === "none" || value === "set") {
    return value;
  }
  throw new CatalogServiceError(
    "Bad Request",
    "location query must be none, set, or all",
  );
}

export async function listWarehouseItems(
  warehouseId: string,
  location: WarehouseItemLocationFilter,
): Promise<ItemRecord[]> {
  return prisma.item.findMany({
    where: {
      warehouseId,
      ...(location === "none"
        ? { locationUnitId: null }
        : location === "set"
          ? { locationUnitId: { not: null } }
          : {}),
    },
    include: itemInclude,
    orderBy: { name: "asc" },
  });
}

export async function unbindItemFromLocation(
  warehouseId: string,
  itemId: string,
): Promise<ItemRecord> {
  const item = await prisma.item.findFirst({
    where: { id: itemId, warehouseId },
  });

  if (!item) {
    throw new CatalogServiceError(
      "ITEM_NOT_FOUND",
      "Item not found in this warehouse",
      404,
    );
  }

  if (!item.locationUnitId) {
    throw new CatalogServiceError(
      "ITEM_NOT_LOCATED",
      "Item is not attached to a location",
      409,
    );
  }

  return prisma.item.update({
    where: { id: item.id },
    data: { locationUnitId: null },
    include: itemInclude,
  });
}

export function parseItemId(body: Record<string, unknown>): string {
  const itemId = typeof body.itemId === "string" ? body.itemId.trim() : "";
  if (!itemId) {
    throw new CatalogServiceError("Bad Request", "itemId is required");
  }
  return itemId;
}
