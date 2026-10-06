import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import {
  ARCHIVED_DISPOSITION_CODES,
  ITEM_CONDITIONS,
  ITEM_DISPOSITIONS,
  ITEM_MATERIALS,
  QR_CODE_TYPE_ITEM,
  QR_CODE_TYPE_LOCATION,
  isArchivedDisposition,
} from "@/lib/db/defaults";
import { prisma } from "@/lib/db/prisma";
import { CatalogServiceError } from "@/lib/item/errors";
import { isImageContentType } from "@/lib/storage/config";
import { getReadUrl } from "@/lib/storage/s3";

const stockInclude = {
  warehouse: { select: { id: true, name: true } },
  locationUnit: {
    select: {
      id: true,
      name: true,
      label: true,
      warehouseId: true,
      qrCodeId: true,
    },
  },
} satisfies Prisma.InventoryStockInclude;

const itemInclude = {
  category: { select: { id: true, code: true, name: true } },
  qrCode: {
    select: { id: true, payload: true, typeId: true, createdAt: true },
  },
  files: {
    select: {
      id: true,
      publicUrl: true,
      status: true,
      sortOrder: true,
      contentType: true,
      s3Key: true,
    },
    orderBy: { sortOrder: "asc" as const },
  },
  stocks: { include: stockInclude },
} satisfies Prisma.ItemInclude;

export type ItemRecord = Prisma.ItemGetPayload<{
  include: typeof itemInclude;
}>;

export type StockPublic = ItemRecord["stocks"][number];

export type ItemFilePublic = {
  id: string;
  publicUrl: string | null;
  status: string;
  sortOrder: number;
  contentType: string;
  readUrl: string | null;
};

export type ItemPublicRecord = Omit<ItemRecord, "files"> & {
  files: ItemFilePublic[];
  quantityOwned: number;
  quantityAvailable: number;
  warehouseId: string | null;
  locationUnitId: string | null;
  locationUnit: StockPublic["locationUnit"];
  locationPath: string | null;
};

export type LocationPathOption = {
  id: string;
  path: string;
  warehouseId: string;
};

export type WarehouseOption = {
  id: string;
  name: string;
};

export type CatalogDetailFields = {
  description: string | null;
  unitRentalPrice: string | null;
  purchaseLink: string | null;
  replacementCost: string | null;
  condition: string | null;
  disposition: string | null;
  notes: string | null;
};

export type CatalogCreateInput = {
  warehouseId: string;
  name: string;
  quantity: number;
  /** Verified file ids in display order (sortOrder 0..n-1). At least one required. */
  photoFileIds: string[];
  categoryId: string | null;
  material: string | null;
} & CatalogDetailFields;

export type CatalogUpdateInput = {
  name?: string;
  quantityOwned?: number;
  categoryId?: string | null;
  material?: string | null;
  photoFileIds?: string[];
} & Partial<CatalogDetailFields>;

function scopedStocks(item: ItemRecord, warehouseId?: string) {
  if (!warehouseId) {
    return item.stocks;
  }
  return item.stocks.filter((stock) => stock.warehouseId === warehouseId);
}

function primaryStock(item: ItemRecord, warehouseId?: string) {
  const stocks = scopedStocks(item, warehouseId);
  return stocks[0] ?? null;
}

function sumStockField(
  stocks: ItemRecord["stocks"],
  field: "quantityOwned" | "quantityAvailable",
) {
  return stocks.reduce((sum, stock) => sum + stock[field], 0);
}

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

function parsePhotoFileIds(
  body: Record<string, unknown>,
  required: boolean,
): string[] {
  if (Array.isArray(body.photoFileIds)) {
    const ids = body.photoFileIds
      .filter((id): id is string => typeof id === "string")
      .map((id) => id.trim())
      .filter(Boolean);
    if (required && ids.length === 0) {
      throw new CatalogServiceError(
        "Bad Request",
        "photoFileIds must include at least one verified file id",
      );
    }
    return [...new Set(ids)];
  }

  const photoFileId =
    typeof body.photoFileId === "string" ? body.photoFileId.trim() : "";
  if (photoFileId) {
    return [photoFileId];
  }
  if (required) {
    throw new CatalogServiceError(
      "Bad Request",
      "photoFileIds (or photoFileId) is required",
    );
  }
  return [];
}

function asOptionalMoney(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const raw =
    typeof value === "number"
      ? value.toString()
      : typeof value === "string"
        ? value.trim()
        : null;
  if (raw === null || !/^\d+(\.\d{1,2})?$/.test(raw)) {
    throw new CatalogServiceError(
      "Bad Request",
      `${field} must be a non-negative amount with up to 2 decimal places`,
    );
  }
  return raw;
}

function asLookupCode(
  value: string | null,
  field: string,
  allowed: readonly { code: string }[],
): string | null {
  if (!value) {
    return null;
  }
  if (!allowed.some((option) => option.code === value)) {
    throw new CatalogServiceError(
      "Bad Request",
      `${field} must be one of: ${allowed.map((option) => option.code).join(", ")}`,
    );
  }
  return value;
}

function parseDetailFields(body: Record<string, unknown>): CatalogDetailFields {
  return {
    description: asOptionalString(body.description, "description"),
    unitRentalPrice: asOptionalMoney(body.unitRentalPrice, "unitRentalPrice"),
    purchaseLink: asOptionalString(body.purchaseLink, "purchaseLink"),
    replacementCost: asOptionalMoney(body.replacementCost, "replacementCost"),
    condition: asLookupCode(
      asOptionalString(body.condition, "condition"),
      "condition",
      ITEM_CONDITIONS,
    ),
    disposition: asLookupCode(
      asOptionalString(body.disposition, "disposition"),
      "disposition",
      ITEM_DISPOSITIONS,
    ),
    notes: asOptionalString(body.notes, "notes"),
  };
}

function parsePositiveInt(value: unknown, field: string): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new CatalogServiceError(
      "Bad Request",
      `${field} must be an integer greater than 0`,
    );
  }
  return parsed;
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

  const details = parseDetailFields(body);
  const material = asLookupCode(
    asOptionalString(body.material, "material"),
    "material",
    ITEM_MATERIALS,
  );

  return {
    warehouseId,
    name,
    quantity: parsePositiveInt(body.quantity, "quantity"),
    photoFileIds: parsePhotoFileIds(body, true),
    categoryId: asOptionalString(body.categoryId, "categoryId"),
    material,
    ...details,
  };
}

export function parseCatalogUpdateInput(
  body: Record<string, unknown>,
): CatalogUpdateInput {
  const input: CatalogUpdateInput = {};

  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      throw new CatalogServiceError("Bad Request", "name is required");
    }
    input.name = name;
  }

  const quantityRaw =
    body.quantityOwned !== undefined ? body.quantityOwned : body.quantity;
  if (quantityRaw !== undefined) {
    input.quantityOwned = parsePositiveInt(quantityRaw, "quantityOwned");
  }

  if (body.categoryId !== undefined) {
    input.categoryId = asOptionalString(body.categoryId, "categoryId");
  }
  if (body.material !== undefined) {
    input.material = asLookupCode(
      asOptionalString(body.material, "material"),
      "material",
      ITEM_MATERIALS,
    );
  }
  if (body.description !== undefined) {
    input.description = asOptionalString(body.description, "description");
  }
  if (body.unitRentalPrice !== undefined) {
    input.unitRentalPrice = asOptionalMoney(
      body.unitRentalPrice,
      "unitRentalPrice",
    );
  }
  if (body.purchaseLink !== undefined) {
    input.purchaseLink = asOptionalString(body.purchaseLink, "purchaseLink");
  }
  if (body.replacementCost !== undefined) {
    input.replacementCost = asOptionalMoney(
      body.replacementCost,
      "replacementCost",
    );
  }
  if (body.condition !== undefined) {
    input.condition = asLookupCode(
      asOptionalString(body.condition, "condition"),
      "condition",
      ITEM_CONDITIONS,
    );
  }
  if (body.disposition !== undefined) {
    input.disposition = asLookupCode(
      asOptionalString(body.disposition, "disposition"),
      "disposition",
      ITEM_DISPOSITIONS,
    );
  }
  if (body.notes !== undefined) {
    input.notes = asOptionalString(body.notes, "notes");
  }
  if (body.photoFileIds !== undefined || body.photoFileId !== undefined) {
    input.photoFileIds = parsePhotoFileIds(body, false);
  }

  if (Object.keys(input).length === 0) {
    throw new CatalogServiceError(
      "Bad Request",
      "Provide at least one field to update",
    );
  }

  return input;
}

type LocationUnitPathRow = {
  id: string;
  name: string;
  label: string | null;
  parentLocationUnitId: string | null;
  warehouseId: string;
  warehouseName: string;
};

function unitDisplayName(unit: LocationUnitPathRow): string {
  const label = unit.label?.trim();
  return label || unit.name;
}

async function loadLocationUnits(
  organizationId: string,
  warehouseId?: string,
): Promise<LocationUnitPathRow[]> {
  const units = await prisma.locationUnit.findMany({
    where: {
      organizationId,
      ...(warehouseId ? { warehouseId } : {}),
    },
    select: {
      id: true,
      name: true,
      label: true,
      parentLocationUnitId: true,
      warehouseId: true,
      warehouse: { select: { name: true } },
    },
    orderBy: { name: "asc" },
  });
  return units.map((unit) => ({
    id: unit.id,
    name: unit.name,
    label: unit.label,
    parentLocationUnitId: unit.parentLocationUnitId,
    warehouseId: unit.warehouseId,
    warehouseName: unit.warehouse.name,
  }));
}

async function loadLocationById(
  organizationId: string,
  warehouseId?: string,
): Promise<Map<string, LocationUnitPathRow>> {
  const units = await loadLocationUnits(organizationId, warehouseId);
  return new Map(units.map((unit) => [unit.id, unit]));
}

export function buildLocationPath(
  unitId: string | null | undefined,
  byId: Map<string, LocationUnitPathRow>,
): string | null {
  if (!unitId) {
    return null;
  }
  const parts: string[] = [];
  const seen = new Set<string>();
  let current = byId.get(unitId);
  const warehouseName = current?.warehouseName;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    parts.unshift(unitDisplayName(current));
    current = current.parentLocationUnitId
      ? byId.get(current.parentLocationUnitId)
      : undefined;
  }
  if (parts.length === 0) {
    return null;
  }
  if (warehouseName) {
    parts.unshift(warehouseName);
  }
  return parts.join(" / ");
}

function descendantLocationIds(
  rootId: string,
  units: LocationUnitPathRow[],
): string[] {
  const children = new Map<string, string[]>();
  for (const unit of units) {
    if (!unit.parentLocationUnitId) {
      continue;
    }
    const list = children.get(unit.parentLocationUnitId) ?? [];
    list.push(unit.id);
    children.set(unit.parentLocationUnitId, list);
  }
  const ids: string[] = [];
  const stack = [rootId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    ids.push(id);
    const nested = children.get(id);
    if (nested) {
      stack.push(...nested);
    }
  }
  return ids;
}

export async function listInventoryLocationPaths(
  organizationId: string,
  warehouseId?: string,
): Promise<LocationPathOption[]> {
  const units = await loadLocationUnits(organizationId, warehouseId);
  const byId = new Map(units.map((unit) => [unit.id, unit]));
  return units
    .map((unit) => ({
      id: unit.id,
      warehouseId: unit.warehouseId,
      path: buildLocationPath(unit.id, byId) ?? unitDisplayName(unit),
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

export async function listWarehouses(
  organizationId: string,
): Promise<WarehouseOption[]> {
  return prisma.warehouse.findMany({
    where: { organizationId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

/** @deprecated Use listInventoryLocationPaths */
export async function listWarehouseLocationPaths(
  organizationId: string,
  warehouseId: string,
): Promise<LocationPathOption[]> {
  return listInventoryLocationPaths(organizationId, warehouseId);
}

export async function withItemReadUrls(
  item: ItemRecord,
  options?: {
    organizationId?: string;
    warehouseId?: string;
    locationById?: Map<string, LocationUnitPathRow>;
  },
): Promise<ItemPublicRecord> {
  const warehouseId = options?.warehouseId;
  const stocks = scopedStocks(item, warehouseId);
  const stock = primaryStock(item, warehouseId);

  const files = await Promise.all(
    item.files.map(async (file) => {
      let readUrl: string | null = file.publicUrl;
      if (!readUrl && file.status === "uploaded") {
        try {
          readUrl = await getReadUrl(file.s3Key);
        } catch {
          readUrl = null;
        }
      }
      return {
        id: file.id,
        publicUrl: file.publicUrl,
        status: file.status,
        sortOrder: file.sortOrder,
        contentType: file.contentType,
        readUrl,
      };
    }),
  );

  const byId =
    options?.locationById ??
    (options?.organizationId
      ? await loadLocationById(
          options.organizationId,
          stock?.warehouseId ?? warehouseId,
        )
      : new Map<string, LocationUnitPathRow>());

  return {
    ...item,
    files,
    stocks,
    quantityOwned: sumStockField(stocks, "quantityOwned"),
    quantityAvailable: sumStockField(stocks, "quantityAvailable"),
    warehouseId: stock?.warehouseId ?? null,
    locationUnitId: stock?.locationUnitId ?? null,
    locationUnit: stock?.locationUnit ?? null,
    locationPath: buildLocationPath(stock?.locationUnitId, byId),
  };
}

export async function withItemsReadUrls(
  items: ItemRecord[],
  options?: { organizationId?: string; warehouseId?: string },
): Promise<ItemPublicRecord[]> {
  const byId = options?.organizationId
    ? await loadLocationById(options.organizationId, options.warehouseId)
    : undefined;
  return Promise.all(
    items.map((item) =>
      withItemReadUrls(item, {
        organizationId: options?.organizationId,
        warehouseId: options?.warehouseId,
        locationById: byId,
      }),
    ),
  );
}

export async function listItemCategories() {
  return prisma.itemCategory.findMany({
    orderBy: { name: "asc" },
    select: { id: true, code: true, name: true },
  });
}

export async function createCatalogItem(
  organizationId: string,
  input: CatalogCreateInput,
): Promise<ItemRecord> {
  const warehouse = await prisma.warehouse.findFirst({
    where: { id: input.warehouseId, organizationId },
    select: { id: true },
  });
  if (!warehouse) {
    throw new CatalogServiceError(
      "WAREHOUSE_NOT_FOUND",
      "warehouseId was not found in this organization",
      404,
    );
  }

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
      where: { id: { in: input.photoFileIds }, organizationId },
      include: { packageFile: { select: { id: true } } },
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
      if (!isImageContentType(file.contentType)) {
        throw new CatalogServiceError(
          "INVALID_CONTENT_TYPE",
          "Item photos must be JPEG, PNG, or WebP images",
          400,
        );
      }
      if (file.itemId || file.packageFile) {
        throw new CatalogServiceError(
          "FILE_ALREADY_ATTACHED",
          "Photo file is already attached to an item or package",
          409,
        );
      }
    }

    const item = await tx.item.create({
      data: {
        organizationId,
        name: input.name,
        categoryId: input.categoryId,
        material: input.material,
        description: input.description,
        unitRentalPrice: input.unitRentalPrice,
        purchaseLink: input.purchaseLink,
        replacementCost: input.replacementCost,
        condition: input.condition,
        disposition: input.disposition,
        notes: input.notes,
      },
    });

    await tx.inventoryStock.create({
      data: {
        organizationId,
        itemId: item.id,
        warehouseId: input.warehouseId,
        quantityOwned: input.quantity,
        quantityAvailable: input.quantity,
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

export async function createItemQrCode(
  organizationId: string,
  itemId: string,
) {
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
      where: { id: itemId, organizationId },
    });

    if (!item) {
      throw new CatalogServiceError(
        "ITEM_NOT_FOUND",
        "Item not found",
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
        organizationId,
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

export async function deleteItemQrCode(
  organizationId: string,
  itemId: string,
) {
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
    where: { id: itemId, organizationId },
    include: { qrCode: true },
  });

  if (!item) {
    throw new CatalogServiceError("ITEM_NOT_FOUND", "Item not found", 404);
  }

  if (!item.qrCode || !item.qrCodeId) {
    throw new CatalogServiceError(
      "QR_CODE_NOT_FOUND",
      "Item does not have a QR code",
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

  const qrCodeId = item.qrCodeId;

  await prisma.$transaction(async (tx) => {
    await tx.item.update({
      where: { id: item.id },
      data: { qrCodeId: null },
    });
    await tx.qrCode.delete({ where: { id: qrCodeId } });
  });

  return { id: qrCodeId, deleted: true as const };
}

export async function resolveWarehouseQr(
  organizationId: string,
  warehouseId: string,
  idOrPayload: string,
) {
  const qrCode = await prisma.qrCode.findFirst({
    where: {
      organizationId,
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
          name: true,
          qrCodeId: true,
          disposition: true,
          stocks: {
            where: { warehouseId, organizationId },
            select: {
              quantityOwned: true,
              locationUnitId: true,
              locationUnit: {
                select: { id: true, name: true, label: true },
              },
            },
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

  const itemStock = qrCode.item?.stocks[0] ?? null;
  const item =
    qrCode.item && itemStock
      ? {
          id: qrCode.item.id,
          warehouseId,
          name: qrCode.item.name,
          qrCodeId: qrCode.item.qrCodeId,
          locationUnitId: itemStock.locationUnitId,
          quantityOwned: itemStock.quantityOwned,
          disposition: qrCode.item.disposition,
          locationUnit: itemStock.locationUnit,
        }
      : null;

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

  if (
    qrCode.type.code === QR_CODE_TYPE_ITEM &&
    item &&
    (isArchivedDisposition(item.disposition) || item.quantityOwned <= 0)
  ) {
    throw new CatalogServiceError(
      "ITEM_ARCHIVED",
      "This item is archived (missing, broken, or removed).",
      409,
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
  organizationId: string,
  warehouseId: string,
  locationUnitId: string,
  itemId: string,
): Promise<ItemRecord> {
  const [locationUnit, item, stock] = await Promise.all([
    prisma.locationUnit.findFirst({
      where: { id: locationUnitId, warehouseId, organizationId },
    }),
    prisma.item.findFirst({
      where: { id: itemId, organizationId },
    }),
    prisma.inventoryStock.findFirst({
      where: { itemId, warehouseId, organizationId },
    }),
  ]);

  if (!locationUnit) {
    throw new CatalogServiceError(
      "LOCATION_UNIT_NOT_FOUND",
      "Location unit not found in this warehouse",
      404,
    );
  }

  if (!item || !stock) {
    throw new CatalogServiceError(
      "ITEM_NOT_FOUND",
      "Item not found in this warehouse",
      404,
    );
  }

  await prisma.inventoryStock.update({
    where: { id: stock.id },
    data: { locationUnitId: locationUnit.id },
  });

  return getWarehouseItem(organizationId, warehouseId, itemId);
}

export type WarehouseItemLocationFilter = "none" | "set" | "all";
export type WarehouseItemArchivedFilter = "0" | "1" | "all";

export type InventoryListFilters = {
  organizationId: string;
  warehouseId?: string;
  location: WarehouseItemLocationFilter;
  q?: string;
  categoryId?: string;
  locationUnitId?: string;
  archived: WarehouseItemArchivedFilter;
};

export type WarehouseItemListFilters = Omit<
  InventoryListFilters,
  "organizationId" | "warehouseId"
>;

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

export function parseWarehouseItemArchivedFilter(
  value: string | null,
): WarehouseItemArchivedFilter {
  if (value === null || value === "" || value === "0") {
    return "0";
  }
  if (value === "1" || value === "all") {
    return value;
  }
  throw new CatalogServiceError(
    "Bad Request",
    "archived query must be 0, 1, or all",
  );
}

export function parseInventoryListFilters(
  organizationId: string,
  searchParams: URLSearchParams,
): InventoryListFilters {
  const q = searchParams.get("q")?.trim() || undefined;
  const categoryId = searchParams.get("categoryId")?.trim() || undefined;
  const locationUnitId =
    searchParams.get("locationUnitId")?.trim() || undefined;
  const warehouseId = searchParams.get("warehouseId")?.trim() || undefined;
  return {
    organizationId,
    warehouseId,
    location: parseWarehouseItemLocationFilter(searchParams.get("location")),
    q,
    categoryId,
    locationUnitId,
    archived: parseWarehouseItemArchivedFilter(searchParams.get("archived")),
  };
}

export function parseWarehouseItemListFilters(
  searchParams: URLSearchParams,
): WarehouseItemListFilters {
  const { organizationId: _organizationId, warehouseId: _warehouseId, ...filters } =
    parseInventoryListFilters("", searchParams);
  return filters;
}

const archivedDispositionCodes: string[] = [...ARCHIVED_DISPOSITION_CODES];

function stockLocationFilter(
  warehouseId: string | undefined,
  locationUnitId: { equals?: null; not?: null; in?: string[] },
): Prisma.InventoryStockWhereInput {
  return {
    ...(warehouseId ? { warehouseId } : {}),
    locationUnitId,
  };
}

export async function listInventoryItems(
  filters: InventoryListFilters,
): Promise<ItemRecord[]> {
  const units = await loadLocationUnits(
    filters.organizationId,
    filters.warehouseId,
  );
  const byId = new Map(units.map((unit) => [unit.id, unit]));
  const and: Prisma.ItemWhereInput[] = [
    { organizationId: filters.organizationId },
  ];

  if (filters.warehouseId) {
    and.push({ stocks: { some: { warehouseId: filters.warehouseId } } });
  }

  if (filters.location === "none") {
    and.push({
      stocks: {
        some: stockLocationFilter(filters.warehouseId, { equals: null }),
      },
    });
  } else if (filters.location === "set") {
    and.push({
      stocks: {
        some: stockLocationFilter(filters.warehouseId, { not: null }),
      },
    });
  }

  if (filters.categoryId) {
    and.push({ categoryId: filters.categoryId });
  }

  if (filters.locationUnitId) {
    const scope = descendantLocationIds(filters.locationUnitId, units);
    and.push({
      stocks: {
        some: stockLocationFilter(filters.warehouseId, { in: scope }),
      },
    });
  }

  if (filters.q) {
    const needle = filters.q.toLowerCase();
    const matchingLocationIds = units
      .filter((unit) => {
        const path = buildLocationPath(unit.id, byId) ?? "";
        return (
          unit.name.toLowerCase().includes(needle) ||
          (unit.label ?? "").toLowerCase().includes(needle) ||
          unit.warehouseName.toLowerCase().includes(needle) ||
          path.toLowerCase().includes(needle)
        );
      })
      .map((unit) => unit.id);
    and.push({
      OR: [
        { name: { contains: filters.q, mode: "insensitive" } },
        {
          stocks: {
            some: {
              ...(filters.warehouseId ? { warehouseId: filters.warehouseId } : {}),
              warehouse: {
                name: { contains: filters.q, mode: "insensitive" },
              },
            },
          },
        },
        ...(matchingLocationIds.length > 0
          ? [
              {
                stocks: {
                  some: stockLocationFilter(filters.warehouseId, {
                    in: matchingLocationIds,
                  }),
                },
              },
            ]
          : []),
      ],
    });
  }

  if (filters.archived === "0") {
    and.push({
      OR: [
        { disposition: null },
        { disposition: { notIn: archivedDispositionCodes } },
      ],
    });
  } else if (filters.archived === "1") {
    and.push({ disposition: { in: archivedDispositionCodes } });
  }

  return prisma.item.findMany({
    where: { AND: and },
    include: itemInclude,
    orderBy: { name: "asc" },
  });
}

export async function listWarehouseItems(
  organizationId: string,
  warehouseId: string,
  filters: WarehouseItemListFilters,
): Promise<ItemRecord[]> {
  return listInventoryItems({ ...filters, organizationId, warehouseId });
}

export async function getInventoryItem(
  organizationId: string,
  itemId: string,
): Promise<ItemRecord> {
  const item = await prisma.item.findFirst({
    where: { id: itemId, organizationId },
    include: itemInclude,
  });
  if (!item) {
    throw new CatalogServiceError("ITEM_NOT_FOUND", "Item not found", 404);
  }
  return item;
}

export async function getWarehouseItem(
  organizationId: string,
  warehouseId: string,
  itemId: string,
): Promise<ItemRecord> {
  const item = await getInventoryItem(organizationId, itemId);
  if (!item.stocks.some((stock) => stock.warehouseId === warehouseId)) {
    throw new CatalogServiceError(
      "ITEM_NOT_FOUND",
      "Item not found in this warehouse",
      404,
    );
  }
  return item;
}

async function assertVerifiedUnattachedFiles(
  tx: Pick<typeof prisma, "file">,
  organizationId: string,
  photoFileIds: string[],
  allowAttachedToItemId?: string,
) {
  if (photoFileIds.length === 0) {
    return [];
  }
  const files = await tx.file.findMany({
    where: { id: { in: photoFileIds }, organizationId },
    include: { packageFile: { select: { id: true } } },
  });
  if (files.length !== photoFileIds.length) {
    throw new CatalogServiceError(
      "FILE_NOT_FOUND",
      "One or more photoFileIds were not found",
      404,
    );
  }
  const byId = new Map(files.map((file) => [file.id, file]));
  for (const fileId of photoFileIds) {
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
    if (!isImageContentType(file.contentType)) {
      throw new CatalogServiceError(
        "INVALID_CONTENT_TYPE",
        "Item photos must be JPEG, PNG, or WebP images",
        400,
      );
    }
    if (
      (file.itemId && file.itemId !== allowAttachedToItemId) ||
      file.packageFile
    ) {
      throw new CatalogServiceError(
        "FILE_ALREADY_ATTACHED",
        "Photo file is already attached to an item or package",
        409,
      );
    }
  }
  return files;
}

export async function updateInventoryItem(
  organizationId: string,
  itemId: string,
  input: CatalogUpdateInput,
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
    const existing = await tx.item.findFirst({
      where: { id: itemId, organizationId },
      include: {
        files: { select: { sortOrder: true } },
        stocks: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!existing) {
      throw new CatalogServiceError("ITEM_NOT_FOUND", "Item not found", 404);
    }

    const photoFileIds = input.photoFileIds ?? [];
    const photoFiles = await assertVerifiedUnattachedFiles(
      tx,
      organizationId,
      photoFileIds,
      existing.id,
    );

    await tx.item.update({
      where: { id: existing.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.categoryId !== undefined
          ? { categoryId: input.categoryId }
          : {}),
        ...(input.material !== undefined ? { material: input.material } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.unitRentalPrice !== undefined
          ? { unitRentalPrice: input.unitRentalPrice }
          : {}),
        ...(input.purchaseLink !== undefined
          ? { purchaseLink: input.purchaseLink }
          : {}),
        ...(input.replacementCost !== undefined
          ? { replacementCost: input.replacementCost }
          : {}),
        ...(input.condition !== undefined ? { condition: input.condition } : {}),
        ...(input.disposition !== undefined
          ? { disposition: input.disposition }
          : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
    });

    if (input.quantityOwned !== undefined && existing.stocks.length > 0) {
      const primary = existing.stocks[0]!;
      await tx.inventoryStock.update({
        where: { id: primary.id },
        data: {
          quantityOwned: input.quantityOwned,
          quantityAvailable: input.quantityOwned,
        },
      });
    }

    const newPhotoFileIds = photoFileIds.filter((fileId) => {
      const file = photoFiles.find((row) => row.id === fileId);
      return file != null && file.itemId !== existing.id;
    });
    if (newPhotoFileIds.length > 0) {
      const nextSort =
        existing.files.reduce(
          (max, file) => Math.max(max, file.sortOrder),
          -1,
        ) + 1;
      await Promise.all(
        newPhotoFileIds.map((fileId, index) =>
          tx.file.update({
            where: { id: fileId },
            data: { itemId: existing.id, sortOrder: nextSort + index },
          }),
        ),
      );
    }

    return tx.item.findUniqueOrThrow({
      where: { id: existing.id },
      include: itemInclude,
    });
  });
}

export async function unbindItemFromLocation(
  organizationId: string,
  warehouseId: string,
  itemId: string,
): Promise<ItemRecord> {
  const stock = await prisma.inventoryStock.findFirst({
    where: { itemId, warehouseId, organizationId },
  });

  if (!stock) {
    throw new CatalogServiceError(
      "ITEM_NOT_FOUND",
      "Item not found in this warehouse",
      404,
    );
  }

  if (!stock.locationUnitId) {
    throw new CatalogServiceError(
      "ITEM_NOT_LOCATED",
      "Item is not attached to a location",
      409,
    );
  }

  await prisma.inventoryStock.update({
    where: { id: stock.id },
    data: { locationUnitId: null },
  });

  return getWarehouseItem(organizationId, warehouseId, itemId);
}
