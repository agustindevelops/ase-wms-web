import "server-only";

import { NextResponse } from "next/server";
import {
  isAuthFailure,
  requireAdmin,
  requireOrgContext,
  type AuthFailure,
  type OrgAuthContext,
} from "@/lib/auth/requireAuth";
import { prisma } from "@/lib/db/prisma";
import { getInventoryItem, type ItemRecord } from "@/lib/item/catalogService";
import { CatalogServiceError } from "@/lib/item/errors";

export type WarehouseAdminContext = OrgAuthContext & {
  warehouseId: string;
};

export type ItemWarehouseAdminContext = OrgAuthContext & {
  warehouseId: string | null;
  item: ItemRecord;
};

function forbiddenWarehouse(): AuthFailure {
  return {
    response: NextResponse.json(
      {
        error: "Forbidden",
        message: "Warehouse not found in this organization",
      },
      { status: 403 },
    ),
  };
}

export async function assertWarehouseInOrg(
  organizationId: string,
  warehouseId: string,
): Promise<true | AuthFailure> {
  const warehouse = await prisma.warehouse.findFirst({
    where: { id: warehouseId, organizationId },
    select: { id: true },
  });
  if (!warehouse) {
    return forbiddenWarehouse();
  }
  return true;
}

/**
 * Org admin + warehouse belongs to the token organization.
 * Used for `/api/warehouse/{warehouseId}/*`.
 */
export async function requireWarehouseAdmin(
  request: Request,
  warehouseId: string,
): Promise<WarehouseAdminContext | AuthFailure> {
  if (!warehouseId) {
    return {
      response: NextResponse.json(
        { error: "Bad Request", message: "warehouseId is required" },
        { status: 400 },
      ),
    };
  }

  const auth = await requireAdmin(request);
  if (isAuthFailure(auth)) {
    return auth;
  }

  const allowed = await assertWarehouseInOrg(auth.organizationId, warehouseId);
  if (allowed !== true) {
    return allowed;
  }

  return {
    ...auth,
    warehouseId,
  };
}

/**
 * Org admin + item belongs to the token organization.
 */
export async function requireItemWarehouseAdmin(
  request: Request,
  itemId: string,
): Promise<ItemWarehouseAdminContext | AuthFailure> {
  if (!itemId) {
    return {
      response: NextResponse.json(
        { error: "Bad Request", message: "itemId is required" },
        { status: 400 },
      ),
    };
  }

  const auth = await requireAdmin(request);
  if (isAuthFailure(auth)) {
    return auth;
  }

  let item: ItemRecord;
  try {
    item = await getInventoryItem(auth.organizationId, itemId);
  } catch (error) {
    if (error instanceof CatalogServiceError && error.status === 404) {
      return {
        response: NextResponse.json(
          { error: error.code, message: error.message },
          { status: 404 },
        ),
      };
    }
    throw error;
  }

  return {
    ...auth,
    warehouseId: item.stocks[0]?.warehouseId ?? null,
    item,
  };
}

/**
 * Verify org admin, then confirm the warehouse is in-org before (or while) loading.
 */
export async function withWarehouseAdminRead<T>(
  request: Request,
  warehouseId: string,
  load: (organizationId: string) => Promise<T>,
): Promise<{ ok: true; data: T; organizationId: string } | AuthFailure> {
  if (!warehouseId) {
    return {
      response: NextResponse.json(
        { error: "Bad Request", message: "warehouseId is required" },
        { status: 400 },
      ),
    };
  }

  const auth = await requireOrgContext(request);
  if (isAuthFailure(auth)) {
    return auth;
  }

  const allowed = await assertWarehouseInOrg(auth.organizationId, warehouseId);
  if (allowed !== true) {
    return allowed;
  }

  return {
    ok: true,
    organizationId: auth.organizationId,
    data: await load(auth.organizationId),
  };
}
