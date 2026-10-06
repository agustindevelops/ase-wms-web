import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { ORDER_STATUS_PAID, ORDER_STATUSES } from "@/lib/db/defaults";
import { prisma } from "@/lib/db/prisma";
import { OrderServiceError } from "@/lib/order/errors";
import { syncOrderStatusFromItems } from "@/lib/order/fulfillmentService";
import {
  asOptionalEventDate,
  asOptionalNonNegativeInt,
  asOptionalTime,
  asPositiveInt,
  asRequiredString,
  formatTime,
  parseAddress,
  parseClientTableDetails,
  parseContact,
  parseOrderDetails,
  parseUploads,
  type AddressInput,
  type ClientTableDetailsInput,
  type ContactInput,
  type OrderDetailsInput,
  type OrderUploadInput,
} from "@/lib/order/orderFields";

const orderListInclude = {
  status: { select: { id: true, code: true, name: true } },
  contact: { select: { firstName: true, lastName: true } },
  package: { select: { id: true, name: true } },
  _count: { select: { items: true } },
} satisfies Prisma.EventOrderInclude;

const orderDetailInclude = {
  status: { select: { id: true, code: true, name: true } },
  createdBy: { select: { id: true, email: true } },
  contact: true,
  address: true,
  package: { select: { id: true, name: true, basePriceCents: true } },
  details: true,
  clientTableDetails: true,
  uploads: { orderBy: { createdAt: "asc" as const } },
  items: {
    include: {
      item: {
        select: {
          id: true,
          name: true,
          stocks: {
            select: {
              warehouseId: true,
              warehouse: { select: { id: true, name: true } },
            },
          },
        },
      },
      allocations: {
        select: {
          qtyPicked: true,
          qtyReturned: true,
          inventoryStock: {
            select: {
              warehouseId: true,
              warehouse: { select: { id: true, name: true } },
            },
          },
        },
      },
      issues: {
        select: {
          id: true,
          type: true,
          quantity: true,
          notes: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" as const },
      },
    },
    orderBy: { createdAt: "asc" as const },
  },
} satisfies Prisma.EventOrderInclude;

export type OrderListRecord = Prisma.EventOrderGetPayload<{
  include: typeof orderListInclude;
}>;

type OrderDetailRaw = Prisma.EventOrderGetPayload<{
  include: typeof orderDetailInclude;
}>;

export type OrderItemDetail = OrderDetailRaw["items"][number] & {
  qtyPicked: number;
  qtyReturned: number;
};

export type OrderDetailRecord = Omit<
  OrderDetailRaw,
  "items" | "eventStartTime" | "eventEndTime"
> & {
  eventStartTime: string | null;
  eventEndTime: string | null;
  items: OrderItemDetail[];
};

export type OrderCreateInput = {
  name: string;
  eventDate: Date | null;
};

export type OrderUpdateInput = {
  name?: string;
  eventDate?: Date | null;
  statusId?: string;
  eventStartTime?: Date | null;
  eventEndTime?: Date | null;
  guestCount?: number | null;
  quote?: number | null;
  contact?: ContactInput | null;
  address?: AddressInput | null;
  details?: OrderDetailsInput | null;
  clientTableDetails?: ClientTableDetailsInput | null;
  uploads?: OrderUploadInput[];
};

export type OrderItemCreateInput = {
  itemId: string;
  qtyRequested: number;
};

export type OrderItemUpdateInput = {
  qtyRequested?: number;
};

export type OrderPackageInput = {
  packageId: string;
  quantity: number;
};

function sumAllocationField(
  allocations: OrderDetailRaw["items"][number]["allocations"],
  field: "qtyPicked" | "qtyReturned",
) {
  return allocations.reduce((sum, allocation) => sum + allocation[field], 0);
}

function mapOrderDetail(order: OrderDetailRaw): OrderDetailRecord {
  return {
    ...order,
    eventStartTime: formatTime(order.eventStartTime),
    eventEndTime: formatTime(order.eventEndTime),
    items: order.items.map((orderItem) => ({
      ...orderItem,
      qtyPicked: sumAllocationField(orderItem.allocations, "qtyPicked"),
      qtyReturned: sumAllocationField(orderItem.allocations, "qtyReturned"),
      item: {
        ...orderItem.item,
        warehouseId:
          orderItem.allocations[0]?.inventoryStock.warehouseId ??
          orderItem.item.stocks[0]?.warehouseId ??
          null,
      },
    })),
  };
}

function asRequiredName(value: unknown): string {
  if (typeof value !== "string") {
    throw new OrderServiceError("Bad Request", "name must be a string");
  }
  const name = value.trim();
  if (!name) {
    throw new OrderServiceError("Bad Request", "name is required");
  }
  return name;
}

export function parseOrderCreateInput(
  body: Record<string, unknown>,
): OrderCreateInput {
  return {
    name: asRequiredName(body.name),
    eventDate: asOptionalEventDate(body.eventDate),
  };
}

export function parseOrderUpdateInput(
  body: Record<string, unknown>,
): OrderUpdateInput {
  const input: OrderUpdateInput = {};
  if (body.name !== undefined) {
    input.name = asRequiredName(body.name);
  }
  if (body.eventDate !== undefined) {
    input.eventDate = asOptionalEventDate(body.eventDate);
  }
  if (body.statusId !== undefined) {
    input.statusId = asRequiredString(body.statusId, "statusId");
  }
  if (body.eventStartTime !== undefined) {
    input.eventStartTime = asOptionalTime(body.eventStartTime, "eventStartTime");
  }
  if (body.eventEndTime !== undefined) {
    input.eventEndTime = asOptionalTime(body.eventEndTime, "eventEndTime");
  }
  if (body.guestCount !== undefined) {
    input.guestCount = asOptionalNonNegativeInt(body.guestCount, "guestCount");
  }
  if (body.quote !== undefined) {
    input.quote = asOptionalNonNegativeInt(body.quote, "quote");
  }
  if (body.contact !== undefined) {
    input.contact = body.contact === null ? null : parseContact(body.contact);
  }
  if (body.address !== undefined) {
    input.address = body.address === null ? null : parseAddress(body.address);
  }
  if (body.details !== undefined) {
    input.details =
      body.details === null
        ? null
        : parseOrderDetails(body.details, { requireWindows: false });
  }
  if (body.clientTableDetails !== undefined) {
    input.clientTableDetails =
      body.clientTableDetails === null
        ? null
        : parseClientTableDetails(body.clientTableDetails);
  }
  if (body.uploads !== undefined) {
    input.uploads = parseUploads(body.uploads);
  }
  if (Object.keys(input).length === 0) {
    throw new OrderServiceError(
      "Bad Request",
      "Provide at least one field to update",
    );
  }
  return input;
}

export function parseOrderItemCreateInput(
  body: Record<string, unknown>,
): OrderItemCreateInput {
  return {
    itemId: asRequiredString(body.itemId, "itemId"),
    qtyRequested: asPositiveInt(body.qtyRequested, "qtyRequested"),
  };
}

export function parseOrderItemUpdate(
  body: Record<string, unknown>,
): OrderItemUpdateInput {
  const input: OrderItemUpdateInput = {};
  if (body.qtyRequested !== undefined) {
    input.qtyRequested = asPositiveInt(body.qtyRequested, "qtyRequested");
  }
  if (
    body.qtyPicked !== undefined ||
    body.qtyReturned !== undefined
  ) {
    throw new OrderServiceError(
      "Bad Request",
      "qtyPicked and qtyReturned are managed through fulfillment allocations",
    );
  }
  if (input.qtyRequested === undefined) {
    throw new OrderServiceError(
      "Bad Request",
      "Provide qtyRequested",
    );
  }
  return input;
}

export function parseOrderPackageInput(
  body: Record<string, unknown>,
): OrderPackageInput {
  return {
    packageId: asRequiredString(body.packageId, "packageId"),
    quantity:
      body.quantity === undefined || body.quantity === null
        ? 1
        : asPositiveInt(body.quantity, "quantity"),
  };
}

export function parseStatusFilter(
  searchParams: URLSearchParams,
): string[] | undefined {
  const codes = searchParams
    .getAll("status")
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
  return codes.length > 0 ? [...new Set(codes)] : undefined;
}

export async function listOrderStatuses() {
  const rows = await prisma.orderStatus.findMany({
    select: { id: true, code: true, name: true },
  });
  const rank = new Map<string, number>(
    ORDER_STATUSES.map((status, index) => [status.code, index]),
  );
  return rows.sort(
    (a, b) => (rank.get(a.code) ?? 99) - (rank.get(b.code) ?? 99),
  );
}

export async function listOrders(
  organizationId: string,
  statusCodes?: string[],
): Promise<OrderListRecord[]> {
  return prisma.eventOrder.findMany({
    where: {
      organizationId,
      ...(statusCodes?.length
        ? { status: { code: { in: statusCodes } } }
        : {}),
    },
    include: orderListInclude,
    orderBy: [{ eventDate: "asc" }, { createdAt: "desc" }],
  });
}

export async function getOrder(
  organizationId: string,
  orderId: string,
): Promise<OrderDetailRecord> {
  const order = await prisma.eventOrder.findFirst({
    where: { id: orderId, organizationId },
    include: orderDetailInclude,
  });
  if (!order) {
    throw new OrderServiceError("Not Found", "Order not found", 404);
  }
  return mapOrderDetail(order);
}

export async function createOrder(
  input: OrderCreateInput,
  createdByUserId: string,
  organizationId: string,
): Promise<OrderDetailRecord> {
  const status = await prisma.orderStatus.findUnique({
    where: { code: ORDER_STATUS_PAID },
  });
  if (!status) {
    throw new OrderServiceError(
      "ORDER_STATUS_MISSING",
      "PAID status is not seeded",
      500,
    );
  }

  const order = await prisma.eventOrder.create({
    data: {
      organizationId,
      name: input.name,
      eventDate: input.eventDate,
      statusId: status.id,
      createdByUserId,
    },
    include: orderDetailInclude,
  });
  return mapOrderDetail(order);
}

export async function updateOrder(
  organizationId: string,
  orderId: string,
  input: OrderUpdateInput,
): Promise<OrderDetailRecord> {
  const existing = await prisma.eventOrder.findFirst({
    where: { id: orderId, organizationId },
    select: { id: true, contactId: true, addressId: true },
  });
  if (!existing) {
    throw new OrderServiceError("Not Found", "Order not found", 404);
  }

  if (input.statusId) {
    const status = await prisma.orderStatus.findUnique({
      where: { id: input.statusId },
    });
    if (!status) {
      throw new OrderServiceError("Bad Request", "Unknown statusId");
    }
  }

  await prisma.$transaction(async (tx) => {
    const data: Prisma.EventOrderUncheckedUpdateInput = {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.eventDate !== undefined ? { eventDate: input.eventDate } : {}),
      ...(input.statusId !== undefined ? { statusId: input.statusId } : {}),
      ...(input.eventStartTime !== undefined
        ? { eventStartTime: input.eventStartTime }
        : {}),
      ...(input.eventEndTime !== undefined
        ? { eventEndTime: input.eventEndTime }
        : {}),
      ...(input.guestCount !== undefined
        ? { guestCount: input.guestCount }
        : {}),
      ...(input.quote !== undefined ? { quote: input.quote } : {}),
    };

    if (input.contact !== undefined) {
      if (input.contact && existing.contactId) {
        await tx.contact.update({
          where: { id: existing.contactId },
          data: input.contact,
        });
      } else if (input.contact) {
        const contact = await tx.contact.create({
          data: { organizationId, ...input.contact },
        });
        data.contactId = contact.id;
      } else if (existing.contactId) {
        data.contactId = null;
      }
    }

    if (input.address !== undefined) {
      if (input.address && existing.addressId) {
        await tx.address.update({
          where: { id: existing.addressId },
          data: input.address,
        });
      } else if (input.address) {
        const address = await tx.address.create({
          data: { organizationId, ...input.address },
        });
        data.addressId = address.id;
      } else if (existing.addressId) {
        data.addressId = null;
      }
    }

    await tx.eventOrder.update({ where: { id: orderId }, data });

    if (input.contact === null && existing.contactId) {
      await tx.contact.delete({ where: { id: existing.contactId } });
    }
    if (input.address === null && existing.addressId) {
      await tx.address.delete({ where: { id: existing.addressId } });
    }

    if (input.details !== undefined) {
      if (input.details) {
        await tx.orderDetails.upsert({
          where: { orderId },
          create: { organizationId, orderId, ...input.details },
          update: input.details,
        });
      } else {
        await tx.orderDetails.deleteMany({ where: { orderId, organizationId } });
      }
    }

    if (input.clientTableDetails !== undefined) {
      if (input.clientTableDetails) {
        await tx.clientTableDetails.upsert({
          where: { orderId },
          create: { organizationId, orderId, ...input.clientTableDetails },
          update: input.clientTableDetails,
        });
      } else {
        await tx.clientTableDetails.deleteMany({
          where: { orderId, organizationId },
        });
      }
    }

    if (input.uploads !== undefined) {
      await tx.orderUpload.deleteMany({ where: { orderId, organizationId } });
      if (input.uploads.length > 0) {
        await tx.orderUpload.createMany({
          data: input.uploads.map((upload) => ({
            organizationId,
            orderId,
            ...upload,
          })),
        });
      }
    }
  });

  return getOrder(organizationId, orderId);
}

/**
 * Copy package items onto the order (qtyRequested increases when the item is
 * already present) and record the package reference. Later package edits do
 * not change the order.
 */
export async function copyPackageItemsToOrder(
  tx: Prisma.TransactionClient,
  organizationId: string,
  orderId: string,
  packageId: string,
  quantity: number,
) {
  const pkg = await tx.package.findFirst({
    where: { id: packageId, organizationId },
    include: { items: { select: { itemId: true, quantity: true } } },
  });
  if (!pkg) {
    throw new OrderServiceError("Bad Request", "Package not found");
  }

  for (const packageItem of pkg.items) {
    const qty = packageItem.quantity * quantity;
    await tx.orderItem.upsert({
      where: { orderId_itemId: { orderId, itemId: packageItem.itemId } },
      create: {
        organizationId,
        orderId,
        itemId: packageItem.itemId,
        qtyRequested: qty,
      },
      update: { qtyRequested: { increment: qty } },
    });
  }

  await tx.eventOrder.update({
    where: { id: orderId },
    data: { packageId: pkg.id },
  });
  return pkg;
}

export async function addPackageToOrder(
  organizationId: string,
  orderId: string,
  input: OrderPackageInput,
): Promise<{ order: OrderDetailRecord; packageName: string }> {
  await getOrder(organizationId, orderId);

  const pkg = await prisma.$transaction(async (tx) => {
    const copied = await copyPackageItemsToOrder(
      tx,
      organizationId,
      orderId,
      input.packageId,
      input.quantity,
    );
    await syncOrderStatusFromItems(tx, organizationId, orderId);
    return copied;
  });

  return {
    order: await getOrder(organizationId, orderId),
    packageName: pkg.name,
  };
}

export async function addOrUpdateOrderItem(
  organizationId: string,
  orderId: string,
  input: OrderItemCreateInput,
): Promise<OrderDetailRecord> {
  await getOrder(organizationId, orderId);

  const item = await prisma.item.findFirst({
    where: { id: input.itemId, organizationId },
    select: { id: true },
  });
  if (!item) {
    throw new OrderServiceError("Bad Request", "Item not found");
  }

  const existing = await prisma.orderItem.findUnique({
    where: {
      orderId_itemId: { orderId, itemId: input.itemId },
    },
  });

  if (existing) {
    await prisma.$transaction(async (tx) => {
      await tx.orderItem.update({
        where: { id: existing.id },
        data: { qtyRequested: input.qtyRequested },
      });
      await syncOrderStatusFromItems(tx, organizationId, orderId);
    });
    return getOrder(organizationId, orderId);
  }

  await prisma.$transaction(async (tx) => {
    await tx.orderItem.create({
      data: {
        organizationId,
        orderId,
        itemId: input.itemId,
        qtyRequested: input.qtyRequested,
      },
    });
    await syncOrderStatusFromItems(tx, organizationId, orderId);
  });

  return getOrder(organizationId, orderId);
}

export async function updateOrderItem(
  organizationId: string,
  orderId: string,
  orderItemId: string,
  input: OrderItemUpdateInput,
): Promise<OrderDetailRecord> {
  await prisma.$transaction(async (tx) => {
    const orderItem = await tx.orderItem.findFirst({
      where: { id: orderItemId, orderId, organizationId },
    });
    if (!orderItem) {
      throw new OrderServiceError("Not Found", "Order item not found", 404);
    }

    await tx.orderItem.update({
      where: { id: orderItemId },
      data: {
        ...(input.qtyRequested !== undefined
          ? { qtyRequested: input.qtyRequested }
          : {}),
      },
    });
    await syncOrderStatusFromItems(tx, organizationId, orderId);
  });

  return getOrder(organizationId, orderId);
}

export async function deleteOrderItem(
  organizationId: string,
  orderId: string,
  orderItemId: string,
): Promise<OrderDetailRecord> {
  await prisma.$transaction(async (tx) => {
    const orderItem = await tx.orderItem.findFirst({
      where: { id: orderItemId, orderId, organizationId },
      include: {
        issues: { select: { quantity: true } },
        allocations: {
          include: { inventoryStock: true },
        },
      },
    });
    if (!orderItem) {
      throw new OrderServiceError("Not Found", "Order item not found", 404);
    }

    const qtyIssued = orderItem.issues.reduce(
      (sum, issue) => sum + issue.quantity,
      0,
    );
    const totalPicked = orderItem.allocations.reduce(
      (sum, allocation) => sum + allocation.qtyPicked,
      0,
    );
    const totalReturned = orderItem.allocations.reduce(
      (sum, allocation) => sum + allocation.qtyReturned,
      0,
    );
    let remainingRestore = Math.max(0, totalPicked - totalReturned - qtyIssued);

    for (const allocation of orderItem.allocations) {
      if (remainingRestore <= 0) {
        break;
      }
      const outstanding = Math.max(
        0,
        allocation.qtyPicked - allocation.qtyReturned,
      );
      const restoreAvailable = Math.min(outstanding, remainingRestore);
      if (restoreAvailable > 0) {
        await tx.inventoryStock.update({
          where: { id: allocation.inventoryStockId },
          data: {
            quantityAvailable: { increment: restoreAvailable },
          },
        });
        remainingRestore -= restoreAvailable;
      }
    }

    await tx.orderItem.delete({ where: { id: orderItemId } });
    await syncOrderStatusFromItems(tx, organizationId, orderId);
  });

  return getOrder(organizationId, orderId);
}
