import "server-only";

import { prisma } from "@/lib/db/prisma";
import { WarehouseServiceError } from "@/lib/warehouse/errors";

export type WarehouseAddressInput = {
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  zipcode: string | null;
  country: string | null;
};

export type WarehouseInput = {
  name: string;
  address: WarehouseAddressInput | null;
};

function optionalAddressField(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value !== "string") {
    throw new WarehouseServiceError("Bad Request", `${field} must be a string`);
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function parseWarehouseInput(body: Record<string, unknown>): WarehouseInput {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    throw new WarehouseServiceError("Bad Request", "name is required");
  }

  if (body.address === undefined) {
    return { name, address: null };
  }

  if (body.address === null) {
    return {
      name,
      address: {
        addressLine1: null,
        addressLine2: null,
        city: null,
        state: null,
        zipcode: null,
        country: null,
      },
    };
  }

  if (typeof body.address !== "object" || Array.isArray(body.address)) {
    throw new WarehouseServiceError("Bad Request", "address must be an object");
  }

  const raw = body.address as Record<string, unknown>;
  return {
    name,
    address: {
      addressLine1: optionalAddressField(raw.addressLine1, "address.addressLine1"),
      addressLine2: optionalAddressField(raw.addressLine2, "address.addressLine2"),
      city: optionalAddressField(raw.city, "address.city"),
      state: optionalAddressField(raw.state, "address.state"),
      zipcode: optionalAddressField(raw.zipcode, "address.zipcode"),
      country: optionalAddressField(raw.country, "address.country"),
    },
  };
}

export async function replaceWarehouse(
  warehouseId: string,
  input: WarehouseInput,
) {
  const existing = await prisma.warehouse.findUnique({
    where: { id: warehouseId },
    select: { id: true },
  });

  if (!existing) {
    throw new WarehouseServiceError(
      "WAREHOUSE_NOT_FOUND",
      "Warehouse not found",
      404,
    );
  }

  const warehouse = await prisma.warehouse.update({
    where: { id: warehouseId },
    data: {
      name: input.name,
      ...(input.address
        ? {
            address: {
              update: input.address,
            },
          }
        : {}),
    },
    include: { address: true },
  });

  return {
    warehouse: {
      id: warehouse.id,
      name: warehouse.name,
      address: warehouse.address,
    },
  };
}
