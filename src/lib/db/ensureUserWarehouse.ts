import "server-only";

import type {
  Role,
  User,
  Warehouse,
  WarehouseMembership,
} from "@/generated/prisma/client";
import {
  ADMIN_ROLE_CODE,
  ADMIN_ROLE_DESCRIPTION,
  ADMIN_ROLE_NAME,
  DEFAULT_WAREHOUSE_ID,
  DEFAULT_WAREHOUSE_NAME,
} from "@/lib/db/defaults";
import { getPrisma } from "@/lib/db/prisma";

export type UserWarehouseContext = {
  user: User;
  warehouse: Warehouse;
  role: Role;
  membership: WarehouseMembership;
};

/**
 * First-login bootstrap: upsert the Prisma User, the single default warehouse
 * (barebones address), ADMIN role, and membership. Idempotent.
 */
export async function ensureUserWarehouse(input: {
  firebaseUid: string;
  email: string;
}): Promise<UserWarehouseContext> {
  const prisma = getPrisma();

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.upsert({
      where: { firebaseUid: input.firebaseUid },
      create: {
        firebaseUid: input.firebaseUid,
        email: input.email,
      },
      update: {
        email: input.email,
      },
    });

    const role = await tx.role.upsert({
      where: { code: ADMIN_ROLE_CODE },
      create: {
        code: ADMIN_ROLE_CODE,
        name: ADMIN_ROLE_NAME,
        description: ADMIN_ROLE_DESCRIPTION,
      },
      update: {},
    });

    const warehouse = await tx.warehouse.upsert({
      where: { id: DEFAULT_WAREHOUSE_ID },
      create: {
        id: DEFAULT_WAREHOUSE_ID,
        name: DEFAULT_WAREHOUSE_NAME,
        address: { create: {} },
      },
      update: {},
    });

    const membership = await tx.warehouseMembership.upsert({
      where: {
        userId_warehouseId: {
          userId: user.id,
          warehouseId: warehouse.id,
        },
      },
      create: {
        userId: user.id,
        warehouseId: warehouse.id,
        roleId: role.id,
      },
      update: {},
    });

    return { user, warehouse, role, membership };
  });
}
