import "server-only";

import type { LocationUnit, Prisma } from "@/generated/prisma/client";
import { CHILD_LOCATION_UNIT_TYPE_CODE } from "@/lib/db/defaults";
import { prisma } from "@/lib/db/prisma";
import { WarehouseServiceError } from "@/lib/warehouse/errors";

const locationUnitInclude = {
  type: { select: { id: true, code: true, name: true } },
  qrCode: {
    select: { id: true, payload: true, typeId: true, createdAt: true },
  },
} satisfies Prisma.LocationUnitInclude;

export type LocationUnitRecord = Prisma.LocationUnitGetPayload<{
  include: typeof locationUnitInclude;
}>;

export type LocationUnitInput = {
  name: string;
  label: string | null;
  parentLocationUnitId: string | null;
};

function asOptionalString(
  value: unknown,
  field: string,
): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value !== "string") {
    throw new WarehouseServiceError(
      "Bad Request",
      `${field} must be a string`,
    );
  }
  return value;
}

export function parseLocationUnitInput(
  body: Record<string, unknown>,
): LocationUnitInput {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    throw new WarehouseServiceError("Bad Request", "name is required");
  }

  return {
    name,
    label: asOptionalString(body.label, "label"),
    parentLocationUnitId: asOptionalString(
      body.parentLocationUnitId,
      "parentLocationUnitId",
    ),
  };
}

/** Type is server-owned. Root → ZONE; otherwise the seeded child of the parent type. */
async function resolveLocationUnitTypeId(
  warehouseId: string,
  parentLocationUnitId: string | null,
): Promise<string> {
  let typeCode = "ZONE";

  if (parentLocationUnitId) {
    const parent = await prisma.locationUnit.findFirst({
      where: { id: parentLocationUnitId, warehouseId },
      include: { type: { select: { code: true } } },
    });
    if (!parent) {
      throw new WarehouseServiceError(
        "PARENT_NOT_FOUND",
        "parentLocationUnitId was not found in this warehouse",
        404,
      );
    }
    typeCode = CHILD_LOCATION_UNIT_TYPE_CODE[parent.type.code] ?? "SHELF";
  }

  const type = await prisma.locationUnitType.findUnique({
    where: { code: typeCode },
  });
  if (!type) {
    throw new WarehouseServiceError(
      "LOCATION_UNIT_TYPE_NOT_SEEDED",
      `Location unit type ${typeCode} is not seeded`,
      500,
    );
  }

  return type.id;
}

async function assertParentInWarehouse(
  warehouseId: string,
  parentLocationUnitId: string | null,
  excludeId?: string,
) {
  if (!parentLocationUnitId) {
    return;
  }

  if (excludeId && parentLocationUnitId === excludeId) {
    throw new WarehouseServiceError(
      "INVALID_PARENT",
      "parentLocationUnitId cannot be the location unit itself",
    );
  }

  const parent = await prisma.locationUnit.findFirst({
    where: { id: parentLocationUnitId, warehouseId },
  });
  if (!parent) {
    throw new WarehouseServiceError(
      "PARENT_NOT_FOUND",
      "parentLocationUnitId was not found in this warehouse",
      404,
    );
  }

  if (excludeId) {
    let current: LocationUnit | null = parent;
    const seen = new Set<string>();
    while (current?.parentLocationUnitId) {
      if (current.parentLocationUnitId === excludeId) {
        throw new WarehouseServiceError(
          "INVALID_PARENT",
          "parentLocationUnitId would create a cycle",
        );
      }
      if (seen.has(current.parentLocationUnitId)) {
        break;
      }
      seen.add(current.parentLocationUnitId);
      current = await prisma.locationUnit.findFirst({
        where: { id: current.parentLocationUnitId, warehouseId },
      });
    }
  }
}

export async function getWarehouseView(warehouseId: string) {
  const [warehouse, locationUnitTypes] = await Promise.all([
    prisma.warehouse.findUnique({
      where: { id: warehouseId },
      include: {
        address: true,
        locationUnits: {
          where: { parentLocationUnitId: null },
          include: locationUnitInclude,
          orderBy: { name: "asc" },
        },
      },
    }),
    prisma.locationUnitType.findMany({
      orderBy: { code: "asc" },
    }),
  ]);

  if (!warehouse) {
    throw new WarehouseServiceError(
      "WAREHOUSE_NOT_FOUND",
      "Warehouse not found",
      404,
    );
  }

  return {
    warehouse: {
      id: warehouse.id,
      name: warehouse.name,
      address: warehouse.address,
    },
    locationUnits: warehouse.locationUnits,
    locationUnitTypes,
  };
}

export async function getLocationUnitWithChildren(
  warehouseId: string,
  id: string,
) {
  const row = await prisma.locationUnit.findFirst({
    where: { id, warehouseId },
    include: {
      type: { select: { id: true, code: true, name: true } },
      qrCode: true,
      children: {
        include: {
          type: { select: { id: true, code: true, name: true } },
          qrCode: true,
        },
        orderBy: { name: "asc" },
      },
    },
  });

  if (!row) {
    throw new WarehouseServiceError(
      "LOCATION_UNIT_NOT_FOUND",
      "Location unit not found in this warehouse",
      404,
    );
  }

  const { children, ...locationUnit } = row;
  return {
    locationUnit,
    children,
    qrCode: locationUnit.qrCode ?? null,
  };
}

export async function createLocationUnit(
  warehouseId: string,
  input: LocationUnitInput,
) {
  await assertParentInWarehouse(warehouseId, input.parentLocationUnitId);
  const locationUnitTypeId = await resolveLocationUnitTypeId(
    warehouseId,
    input.parentLocationUnitId,
  );

  return prisma.locationUnit.create({
    data: {
      warehouseId,
      name: input.name,
      label: input.label,
      locationUnitTypeId,
      parentLocationUnitId: input.parentLocationUnitId,
    },
    include: locationUnitInclude,
  });
}

export async function replaceLocationUnit(
  warehouseId: string,
  id: string,
  input: LocationUnitInput,
) {
  const existing = await prisma.locationUnit.findFirst({
    where: { id, warehouseId },
  });
  if (!existing) {
    throw new WarehouseServiceError(
      "LOCATION_UNIT_NOT_FOUND",
      "Location unit not found in this warehouse",
      404,
    );
  }

  await assertParentInWarehouse(warehouseId, input.parentLocationUnitId, id);

  const locationUnitTypeId =
    input.parentLocationUnitId === existing.parentLocationUnitId
      ? existing.locationUnitTypeId
      : await resolveLocationUnitTypeId(
          warehouseId,
          input.parentLocationUnitId,
        );

  return prisma.locationUnit.update({
    where: { id },
    data: {
      name: input.name,
      label: input.label,
      locationUnitTypeId,
      parentLocationUnitId: input.parentLocationUnitId,
    },
    include: locationUnitInclude,
  });
}

export async function deleteLocationUnit(warehouseId: string, id: string) {
  const existing = await prisma.locationUnit.findFirst({
    where: { id, warehouseId },
    include: { children: { select: { id: true }, take: 1 } },
  });

  if (!existing) {
    throw new WarehouseServiceError(
      "LOCATION_UNIT_NOT_FOUND",
      "Location unit not found in this warehouse",
      404,
    );
  }

  if (existing.children.length > 0) {
    throw new WarehouseServiceError(
      "LOCATION_UNIT_HAS_CHILDREN",
      "Delete child location units before deleting this one",
      409,
    );
  }

  await prisma.$transaction(async (tx) => {
    if (existing.qrCodeId) {
      await tx.locationUnit.update({
        where: { id },
        data: { qrCodeId: null },
      });
      await tx.qrCode.delete({ where: { id: existing.qrCodeId } });
    }

    await tx.locationUnit.delete({ where: { id } });
  });

  return { id, deleted: true };
}
