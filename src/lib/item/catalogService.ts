import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import {
  ARCHIVED_DISPOSITION_CODES,
  ITEM_CONDITIONS,
  ITEM_DISPOSITIONS,
  ITEM_MATERIALS,
  QR_CODE_TYPE_ITEM,
  QR_CODE_TYPE_LOCATION,
} from "@/lib/db/defaults";
import { prisma } from "@/lib/db/prisma";
import { CatalogServiceError } from "@/lib/item/errors";
import { getReadUrl } from "@/lib/storage/s3";

const itemInclude = {
  warehouse: { select: { id: true, name: true } },
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
      s3Key: true,
    },
    orderBy: { sortOrder: "asc" as const },
  },
} satisfies Prisma.ItemInclude;

export type ItemRecord = Prisma.ItemGetPayload<{
  include: typeof itemInclude;
}>;

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
  warehouseId?: string,
): Promise<LocationUnitPathRow[]> {
  const units = await prisma.locationUnit.findMany({
    where: warehouseId ? { warehouseId } : undefined,
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
  warehouseId?: string,
): Promise<Map<string, LocationUnitPathRow>> {
  const units = await loadLocationUnits(warehouseId);
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
  warehouseId?: string,
): Promise<LocationPathOption[]> {
  const units = await loadLocationUnits(warehouseId);
  const byId = new Map(units.map((unit) => [unit.id, unit]));
  return units
    .map((unit) => ({
      id: unit.id,
      warehouseId: unit.warehouseId,
      path: buildLocationPath(unit.id, byId) ?? unitDisplayName(unit),
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

export async function listWarehouses(): Promise<WarehouseOption[]> {
  return prisma.warehouse.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

/** @deprecated Use listInventoryLocationPaths */
export async function listWarehouseLocationPaths(
  warehouseId: string,
): Promise<LocationPathOption[]> {
  return listInventoryLocationPaths(warehouseId);
}

export async function withItemReadUrls(
  item: ItemRecord,
  locationById?: Map<string, LocationUnitPathRow>,
): Promise<ItemPublicRecord> {
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
  const byId = locationById ?? (await loadLocationById(item.warehouseId));
  const { files: _files, ...rest } = item;
  return {
    ...rest,
    files,
    locationPath: buildLocationPath(item.locationUnitId, byId),
  };
}

export async function withItemsReadUrls(
  items: ItemRecord[],
): Promise<ItemPublicRecord[]> {
  const byId = await loadLocationById();
  return Promise.all(items.map((item) => withItemReadUrls(item, byId)));
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
        description: input.description,
        unitRentalPrice: input.unitRentalPrice,
        purchaseLink: input.purchaseLink,
        replacementCost: input.replacementCost,
        condition: input.condition,
        disposition: input.disposition,
        notes: input.notes,
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
export type WarehouseItemArchivedFilter = "0" | "1" | "all";

export type InventoryListFilters = {
  warehouseId?: string;
  location: WarehouseItemLocationFilter;
  q?: string;
  categoryId?: string;
  locationUnitId?: string;
  archived: WarehouseItemArchivedFilter;
};

export type WarehouseItemListFilters = Omit<InventoryListFilters, "warehouseId">;

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
  searchParams: URLSearchParams,
): InventoryListFilters {
  const q = searchParams.get("q")?.trim() || undefined;
  const categoryId = searchParams.get("categoryId")?.trim() || undefined;
  const locationUnitId =
    searchParams.get("locationUnitId")?.trim() || undefined;
  const warehouseId = searchParams.get("warehouseId")?.trim() || undefined;
  return {
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
  const { warehouseId: _warehouseId, ...filters } =
    parseInventoryListFilters(searchParams);
  return filters;
}

const archivedDispositionCodes: string[] = [...ARCHIVED_DISPOSITION_CODES];

export async function listInventoryItems(
  filters: InventoryListFilters,
): Promise<ItemRecord[]> {
  const units = await loadLocationUnits(filters.warehouseId);
  const byId = new Map(units.map((unit) => [unit.id, unit]));
  const and: Prisma.ItemWhereInput[] = [];

  if (filters.warehouseId) {
    and.push({ warehouseId: filters.warehouseId });
  }

  if (filters.location === "none") {
    and.push({ locationUnitId: null });
  } else if (filters.location === "set") {
    and.push({ locationUnitId: { not: null } });
  }

  if (filters.categoryId) {
    and.push({ categoryId: filters.categoryId });
  }

  if (filters.locationUnitId) {
    const scope = descendantLocationIds(filters.locationUnitId, units);
    and.push({ locationUnitId: { in: scope } });
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
        { warehouse: { name: { contains: filters.q, mode: "insensitive" } } },
        ...(matchingLocationIds.length > 0
          ? [{ locationUnitId: { in: matchingLocationIds } }]
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
    where: and.length > 0 ? { AND: and } : {},
    include: itemInclude,
    orderBy: { name: "asc" },
  });
}

export async function listWarehouseItems(
  warehouseId: string,
  filters: WarehouseItemListFilters,
): Promise<ItemRecord[]> {
  return listInventoryItems({ ...filters, warehouseId });
}

export async function getInventoryItem(itemId: string): Promise<ItemRecord> {
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    include: itemInclude,
  });
  if (!item) {
    throw new CatalogServiceError("ITEM_NOT_FOUND", "Item not found", 404);
  }
  return item;
}

export async function getWarehouseItem(
  warehouseId: string,
  itemId: string,
): Promise<ItemRecord> {
  const item = await getInventoryItem(itemId);
  if (item.warehouseId !== warehouseId) {
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
  photoFileIds: string[],
) {
  if (photoFileIds.length === 0) {
    return;
  }
  const files = await tx.file.findMany({
    where: { id: { in: photoFileIds } },
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
    if (file.itemId) {
      throw new CatalogServiceError(
        "FILE_ALREADY_ATTACHED",
        "Photo file is already attached to an item",
        409,
      );
    }
  }
}

export async function updateInventoryItem(
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
    const existing = await tx.item.findUnique({
      where: { id: itemId },
      include: { files: { select: { sortOrder: true } } },
    });
    if (!existing) {
      throw new CatalogServiceError("ITEM_NOT_FOUND", "Item not found", 404);
    }

    const photoFileIds = input.photoFileIds ?? [];
    await assertVerifiedUnattachedFiles(tx, photoFileIds);

    await tx.item.update({
      where: { id: existing.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.quantityOwned !== undefined
          ? {
              quantityOwned: input.quantityOwned,
              quantityAvailable: input.quantityOwned,
            }
          : {}),
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

    if (photoFileIds.length > 0) {
      const nextSort =
        existing.files.reduce(
          (max, file) => Math.max(max, file.sortOrder),
          -1,
        ) + 1;
      await Promise.all(
        photoFileIds.map((fileId, index) =>
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

export async function updateWarehouseItem(
  warehouseId: string,
  itemId: string,
  input: CatalogUpdateInput,
): Promise<ItemRecord> {
  await getWarehouseItem(warehouseId, itemId);
  return updateInventoryItem(itemId, input);
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
