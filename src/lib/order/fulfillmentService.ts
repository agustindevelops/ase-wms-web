import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import {
  ISSUE_TYPES,
  ORDER_STATUS_PAID,
  ORDER_STATUS_PICKED_UP,
  ORDER_STATUS_RETURNED,
  QR_CODE_TYPE_ITEM,
  QR_CODE_TYPE_LOCATION,
  isIssueArchivedDisposition,
  type IssueType,
} from "@/lib/db/defaults";
import { chicagoDayBounds } from "@/lib/dashboard/dashboardService";
import { prisma } from "@/lib/db/prisma";
import { OrderServiceError } from "@/lib/order/errors";
import {
  canMutatePickup,
  canMutateReturn,
  canReportOrderIssue,
} from "@/lib/order/orderStatus";

const locationUnitNameSelect = {
  id: true,
  name: true,
  label: true,
  warehouseId: true,
} as const;

/** Nested names so return/pickup copy can say "Zone / Aisle / Shelf". */
const locationUnitPathSelect = {
  ...locationUnitNameSelect,
  parent: {
    select: {
      name: true,
      label: true,
      parent: {
        select: {
          name: true,
          label: true,
          parent: {
            select: {
              name: true,
              label: true,
              parent: { select: { name: true, label: true } },
            },
          },
        },
      },
    },
  },
} as const;

const fulfillmentLineInclude = {
  item: {
    select: {
      id: true,
      name: true,
      disposition: true,
      stocks: {
        select: {
          warehouseId: true,
          quantityOwned: true,
          quantityAvailable: true,
          locationUnit: { select: locationUnitPathSelect },
        },
      },
    },
  },
  allocations: {
    include: {
      inventoryStock: {
        select: {
          warehouseId: true,
          quantityOwned: true,
          quantityAvailable: true,
          locationUnit: { select: locationUnitPathSelect },
        },
      },
    },
  },
  issues: {
    select: { id: true, type: true, quantity: true },
  },
} satisfies Prisma.OrderLineInclude;

const fulfillmentOrderInclude = {
  status: { select: { id: true, code: true, name: true } },
  lines: {
    include: fulfillmentLineInclude,
    orderBy: { createdAt: "asc" as const },
  },
} satisfies Prisma.EventOrderInclude;

type FulfillmentOrderRecord = Prisma.EventOrderGetPayload<{
  include: typeof fulfillmentOrderInclude;
}>;

export type FulfillmentMode = "pickup" | "return";

function sumAllocations(
  allocations: FulfillmentOrderRecord["lines"][number]["allocations"],
  field: "qtyPicked" | "qtyReturned",
) {
  return allocations.reduce((sum, allocation) => sum + allocation[field], 0);
}

function sumItemStocks(
  stocks: FulfillmentOrderRecord["lines"][number]["item"]["stocks"],
  field: "quantityOwned" | "quantityAvailable",
) {
  return stocks.reduce((sum, stock) => sum + stock[field], 0);
}

function primaryAllocationStock(
  line: FulfillmentOrderRecord["lines"][number],
) {
  return line.allocations[0]?.inventoryStock ?? line.item.stocks[0] ?? null;
}

function asPositiveQty(value: unknown, field: string): number {
  const qty =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;
  if (!Number.isInteger(qty) || qty <= 0) {
    throw new OrderServiceError(
      "Bad Request",
      `${field} must be an integer greater than 0`,
    );
  }
  return qty;
}

function asRequiredString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new OrderServiceError("Bad Request", `${field} must be a string`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new OrderServiceError("Bad Request", `${field} is required`);
  }
  return trimmed;
}

export function parsePickBody(body: Record<string, unknown>): {
  itemId: string;
  qty: number;
  warehouseId?: string;
} {
  const warehouseId =
    typeof body.warehouseId === "string" ? body.warehouseId.trim() : undefined;
  return {
    itemId: asRequiredString(body.itemId, "itemId"),
    qty: asPositiveQty(body.qty, "qty"),
    ...(warehouseId ? { warehouseId } : {}),
  };
}

export function parseReturnBody(body: Record<string, unknown>): {
  itemId: string;
  qty: number;
  locationUnitId: string;
} {
  return {
    itemId: asRequiredString(body.itemId, "itemId"),
    qty: asPositiveQty(body.qty, "qty"),
    locationUnitId: asRequiredString(body.locationUnitId, "locationUnitId"),
  };
}

export function parseIssueBody(body: Record<string, unknown>): {
  itemId: string;
  type: IssueType;
  quantity: number;
  notes: string | null;
} {
  const type = asRequiredString(body.type, "type");
  if (!ISSUE_TYPES.includes(type as IssueType)) {
    throw new OrderServiceError(
      "Bad Request",
      "type must be MISSING or BROKEN",
    );
  }
  let notes: string | null = null;
  if (body.notes !== undefined && body.notes !== null) {
    if (typeof body.notes !== "string") {
      throw new OrderServiceError("Bad Request", "notes must be a string");
    }
    notes = body.notes.trim() || null;
  }
  return {
    itemId: asRequiredString(body.itemId, "itemId"),
    type: type as IssueType,
    quantity: asPositiveQty(body.quantity, "quantity"),
    notes,
  };
}

type LocationNameNode = {
  name: string;
  label: string | null;
  parent?: LocationNameNode | null;
};

function unitDisplayName(unit: {
  name: string;
  label: string | null;
}): string {
  return unit.label?.trim() || unit.name.trim();
}

function locationLabel(unit: LocationNameNode | null): string | null {
  if (!unit) return null;
  const parts: string[] = [];
  let current: LocationNameNode | null | undefined = unit;
  while (current) {
    const name = unitDisplayName(current);
    if (name) parts.unshift(name);
    current = current.parent;
  }
  return parts.length > 0 ? parts.join(" / ") : null;
}

function wrongHomeLocationError(home: LocationNameNode): OrderServiceError {
  const expected = locationLabel(home);
  return new OrderServiceError(
    "LOCATION_WRONG_HOME",
    expected
      ? `Wrong location. Return this item to ${expected}.`
      : "Wrong location. Return this item to its assigned location.",
  );
}

function assertHomeLocation(
  home: { id: string } & LocationNameNode,
  scannedLocationId: string,
) {
  if (home.id !== scannedLocationId) {
    throw wrongHomeLocationError(home);
  }
}

function mapLine(line: FulfillmentOrderRecord["lines"][number]) {
  const qtyPicked = sumAllocations(line.allocations, "qtyPicked");
  const qtyReturned = sumAllocations(line.allocations, "qtyReturned");
  const stock = primaryAllocationStock(line);
  const archived = isIssueArchivedDisposition(line.item.disposition);
  const qtyIssued = line.issues.reduce((sum, issue) => sum + issue.quantity, 0);
  const qtyRemaining = archived
    ? 0
    : Math.max(0, line.qtyRequested - qtyPicked);
  const qtyOutstanding = Math.max(
    0,
    qtyPicked - qtyReturned - qtyIssued,
  );
  return {
    id: line.id,
    itemId: line.itemId,
    qtyRequested: line.qtyRequested,
    qtyPicked,
    qtyReturned,
    qtyRemaining,
    qtyOutstanding,
    qtyIssued,
    item: {
      id: line.item.id,
      name: line.item.name,
      warehouseId: stock?.warehouseId ?? null,
      quantityOwned: sumItemStocks(line.item.stocks, "quantityOwned"),
      quantityAvailable: sumItemStocks(line.item.stocks, "quantityAvailable"),
      archived,
      locationLabel: locationLabel(stock?.locationUnit ?? null),
      locationUnit: stock?.locationUnit
        ? {
            id: stock.locationUnit.id,
            name: stock.locationUnit.name,
            label: stock.locationUnit.label,
            warehouseId: stock.locationUnit.warehouseId,
          }
        : null,
    },
  };
}

function mapOrder(order: FulfillmentOrderRecord) {
  return {
    id: order.id,
    name: order.name,
    eventDate: order.eventDate,
    statusId: order.statusId,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    status: order.status,
    lines: order.lines.map(mapLine),
  };
}

async function loadFulfillmentOrder(
  organizationId: string,
  orderId: string,
): Promise<FulfillmentOrderRecord> {
  const order = await prisma.eventOrder.findFirst({
    where: { id: orderId, organizationId },
    include: fulfillmentOrderInclude,
  });
  if (!order) {
    throw new OrderServiceError("Not Found", "Order not found", 404);
  }
  return order;
}

function assertPickupEligible(order: FulfillmentOrderRecord) {
  if (!canMutatePickup(order)) {
    throw new OrderServiceError(
      "ORDER_NOT_ELIGIBLE",
      "Order is not eligible for pickup",
      409,
    );
  }
}

function assertReturnEligible(order: FulfillmentOrderRecord) {
  if (!canMutateReturn(order)) {
    throw new OrderServiceError(
      "ORDER_NOT_ELIGIBLE",
      "Order is not eligible for return",
      409,
    );
  }
}

async function setOrderStatusByCode(
  tx: Prisma.TransactionClient,
  orderId: string,
  code: string,
) {
  const status = await tx.orderStatus.findUnique({ where: { code } });
  if (!status) {
    throw new OrderServiceError(
      "ORDER_STATUS_MISSING",
      `${code} status is not seeded`,
      500,
    );
  }
  await tx.eventOrder.update({
    where: { id: orderId },
    data: { statusId: status.id },
  });
}

export async function syncOrderStatusFromLines(
  tx: Prisma.TransactionClient,
  organizationId: string,
  orderId: string,
) {
  const lines = await tx.orderLine.findMany({
    where: { orderId, organizationId },
    select: {
      qtyRequested: true,
      allocations: { select: { qtyPicked: true, qtyReturned: true } },
      issues: { select: { quantity: true } },
      item: { select: { disposition: true } },
    },
  });
  if (lines.length === 0) {
    await setOrderStatusByCode(tx, orderId, ORDER_STATUS_PAID);
    return;
  }

  const allPicked = lines.every((row) => {
    const qtyPicked = row.allocations.reduce(
      (sum, allocation) => sum + allocation.qtyPicked,
      0,
    );
    return (
      isIssueArchivedDisposition(row.item.disposition) ||
      qtyPicked >= row.qtyRequested
    );
  });
  const allReturned = lines.every((row) => {
    const qtyPicked = row.allocations.reduce(
      (sum, allocation) => sum + allocation.qtyPicked,
      0,
    );
    const qtyReturned = row.allocations.reduce(
      (sum, allocation) => sum + allocation.qtyReturned,
      0,
    );
    const qtyIssued = row.issues.reduce((sum, issue) => sum + issue.quantity, 0);
    return qtyReturned + qtyIssued >= qtyPicked;
  });
  const hasPickedQty = lines.some((row) =>
    row.allocations.some((allocation) => allocation.qtyPicked > 0),
  );

  if (allPicked && allReturned && hasPickedQty) {
    await setOrderStatusByCode(tx, orderId, ORDER_STATUS_RETURNED);
    return;
  }
  if (allPicked) {
    await setOrderStatusByCode(tx, orderId, ORDER_STATUS_PICKED_UP);
    return;
  }
  await setOrderStatusByCode(tx, orderId, ORDER_STATUS_PAID);
}

function todayEventDate(): Date {
  const { day } = chicagoDayBounds();
  return new Date(`${day}T00:00:00.000Z`);
}

async function listOrdersForToday(organizationId: string) {
  const orders = await prisma.eventOrder.findMany({
    where: { organizationId, eventDate: todayEventDate() },
    include: fulfillmentOrderInclude,
    orderBy: [{ eventDate: "asc" }, { createdAt: "desc" }],
  });
  return orders.map(mapOrder);
}

export async function listPickupOrders(organizationId: string) {
  return listOrdersForToday(organizationId);
}

export async function getPickupOrder(
  organizationId: string,
  orderId: string,
) {
  const order = await loadFulfillmentOrder(organizationId, orderId);
  return mapOrder(order);
}

export async function listReturnOrders(organizationId: string) {
  return listOrdersForToday(organizationId);
}

export async function getReturnOrder(
  organizationId: string,
  orderId: string,
) {
  const order = await loadFulfillmentOrder(organizationId, orderId);
  return mapOrder(order);
}

async function findQr(organizationId: string, idOrPayload: string) {
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
        },
      },
    },
  });
  if (!qrCode) {
    throw new OrderServiceError("QR_CODE_NOT_FOUND", "QR code not found", 404);
  }
  return qrCode;
}

export async function scanFulfillmentQr(
  organizationId: string,
  orderId: string,
  payload: string,
  mode: FulfillmentMode,
  itemId?: string,
) {
  const trimmed = payload.trim();
  if (!trimmed) {
    throw new OrderServiceError("Bad Request", "payload is required");
  }

  const order =
    mode === "pickup"
      ? await loadFulfillmentOrder(organizationId, orderId).then((row) => {
          assertPickupEligible(row);
          return row;
        })
      : await loadFulfillmentOrder(organizationId, orderId).then((row) => {
          assertReturnEligible(row);
          return row;
        });

  const qrCode = await findQr(organizationId, trimmed);
  const mapped = mapOrder(order);

  if (qrCode.type.code === QR_CODE_TYPE_LOCATION) {
    if (mode === "pickup") {
      throw new OrderServiceError(
        "QR_WRONG_TYPE",
        "That QR is not an item label. Scan an item QR.",
      );
    }
    if (!qrCode.locationUnit) {
      throw new OrderServiceError(
        "QR_CODE_NOT_FOUND",
        "Location QR is not bound to a location",
        404,
      );
    }
    if (itemId) {
      const line = order.lines.find((row) => row.itemId === itemId);
      if (!line) {
        throw new OrderServiceError(
          "ITEM_NOT_ON_ORDER",
          "That item is not on this order",
        );
      }
      const stock = primaryAllocationStock(line);
      if (stock?.locationUnit) {
        assertHomeLocation(stock.locationUnit, qrCode.locationUnit.id);
      }
    }
    return {
      typeCode: qrCode.type.code,
      locationUnit: qrCode.locationUnit,
      line: null,
    };
  }

  if (qrCode.type.code !== QR_CODE_TYPE_ITEM || !qrCode.item) {
    throw new OrderServiceError(
      "QR_WRONG_TYPE",
      "That QR is not an item label. Scan an item QR.",
    );
  }

  const line = mapped.lines.find((row) => row.itemId === qrCode.item!.id);
  if (!line) {
    throw new OrderServiceError(
      "ITEM_NOT_ON_ORDER",
      "That item is not on this order",
    );
  }

  if (line.item.archived && mode === "pickup") {
    throw new OrderServiceError(
      "ITEM_ARCHIVED",
      "This item is archived (missing or broken).",
      409,
    );
  }

  if (mode === "pickup" && line.qtyRemaining === 0) {
    throw new OrderServiceError(
      "LINE_COMPLETE",
      "This line is already fully picked",
    );
  }
  if (mode === "return" && line.qtyOutstanding === 0) {
    throw new OrderServiceError(
      "LINE_COMPLETE",
      "This line has no outstanding return quantity",
    );
  }

  return {
    typeCode: qrCode.type.code,
    locationUnit: null,
    line,
  };
}

async function getMappedOrder(organizationId: string, orderId: string) {
  return mapOrder(await loadFulfillmentOrder(organizationId, orderId));
}

async function findPickStock(
  tx: Prisma.TransactionClient,
  organizationId: string,
  itemId: string,
  warehouseId?: string,
) {
  return tx.inventoryStock.findFirst({
    where: {
      organizationId,
      itemId,
      ...(warehouseId ? { warehouseId } : {}),
      quantityAvailable: { gt: 0 },
    },
    orderBy: [{ quantityAvailable: "desc" }, { createdAt: "asc" }],
  });
}

export async function pickOrderLine(
  organizationId: string,
  orderId: string,
  itemId: string,
  qty: number,
  warehouseId?: string,
) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.eventOrder.findFirst({
      where: { id: orderId, organizationId },
      include: {
        status: true,
        lines: {
          include: {
            item: { select: { disposition: true } },
            allocations: true,
          },
        },
      },
    });
    if (!order) {
      throw new OrderServiceError("Not Found", "Order not found", 404);
    }
    if (!canMutatePickup(order)) {
      throw new OrderServiceError(
        "ORDER_NOT_ELIGIBLE",
        "Order is not eligible for pickup",
        409,
      );
    }

    const line = order.lines.find((row) => row.itemId === itemId);
    if (!line) {
      throw new OrderServiceError(
        "ITEM_NOT_ON_ORDER",
        "That item is not on this order",
      );
    }

    if (isIssueArchivedDisposition(line.item.disposition)) {
      throw new OrderServiceError(
        "ITEM_ARCHIVED",
        "This item is archived (missing or broken).",
        409,
      );
    }

    const qtyPicked = line.allocations.reduce(
      (sum, allocation) => sum + allocation.qtyPicked,
      0,
    );
    const remaining = line.qtyRequested - qtyPicked;
    if (qty > remaining) {
      throw new OrderServiceError(
        "OVER_PICK",
        `Cannot pick more than remaining (${remaining})`,
      );
    }

    const stock = await findPickStock(tx, organizationId, itemId, warehouseId);
    if (!stock) {
      throw new OrderServiceError(
        "INSUFFICIENT_AVAILABLE",
        "No available stock for this item",
      );
    }
    if (qty > stock.quantityAvailable) {
      throw new OrderServiceError(
        "INSUFFICIENT_AVAILABLE",
        `Only ${stock.quantityAvailable} available`,
      );
    }

    const existingAllocation = await tx.orderLineAllocation.findUnique({
      where: {
        orderLineId_inventoryStockId: {
          orderLineId: line.id,
          inventoryStockId: stock.id,
        },
      },
    });

    if (existingAllocation) {
      const nextPicked = existingAllocation.qtyPicked + qty;
      await tx.orderLineAllocation.update({
        where: { id: existingAllocation.id },
        data: {
          qtyPicked: { increment: qty },
          qtyAllocated: Math.max(existingAllocation.qtyAllocated, nextPicked),
        },
      });
    } else {
      await tx.orderLineAllocation.create({
        data: {
          organizationId,
          orderLineId: line.id,
          inventoryStockId: stock.id,
          qtyAllocated: qty,
          qtyPicked: qty,
        },
      });
    }

    await tx.inventoryStock.update({
      where: { id: stock.id },
      data: { quantityAvailable: { decrement: qty } },
    });

    await syncOrderStatusFromLines(tx, organizationId, orderId);
  }).then(() => getMappedOrder(organizationId, orderId));
}

export async function returnOrderLine(
  organizationId: string,
  orderId: string,
  itemId: string,
  qty: number,
  locationUnitId: string,
) {
  await prisma.$transaction(async (tx) => {
    const order = await tx.eventOrder.findFirst({
      where: { id: orderId, organizationId },
      include: {
        status: true,
        lines: {
          include: {
            allocations: {
              include: {
                inventoryStock: {
                  include: {
                    locationUnit: { select: locationUnitPathSelect },
                  },
                },
              },
              orderBy: { qtyPicked: "desc" },
            },
          },
        },
      },
    });
    if (!order) {
      throw new OrderServiceError("Not Found", "Order not found", 404);
    }
    if (!canMutateReturn(order)) {
      throw new OrderServiceError(
        "ORDER_NOT_ELIGIBLE",
        "Order is not eligible for return",
        409,
      );
    }

    const line = order.lines.find((row) => row.itemId === itemId);
    if (!line) {
      throw new OrderServiceError(
        "ITEM_NOT_ON_ORDER",
        "That item is not on this order",
      );
    }

    const qtyPicked = line.allocations.reduce(
      (sum, allocation) => sum + allocation.qtyPicked,
      0,
    );
    const qtyReturned = line.allocations.reduce(
      (sum, allocation) => sum + allocation.qtyReturned,
      0,
    );
    const issued = await tx.issue.aggregate({
      where: { orderLineId: line.id, organizationId },
      _sum: { quantity: true },
    });
    const qtyIssued = issued._sum.quantity ?? 0;
    const remainingToReturn = qtyPicked - qtyReturned - qtyIssued;
    if (qty > remainingToReturn) {
      throw new OrderServiceError(
        "OVER_RETURN",
        `Cannot return more than outstanding (${remainingToReturn})`,
      );
    }

    const allocation =
      line.allocations.find(
        (row) => row.qtyPicked - row.qtyReturned > 0,
      ) ?? line.allocations[0];
    if (!allocation) {
      throw new OrderServiceError(
        "OVER_RETURN",
        "No picked allocation exists for this line",
      );
    }

    const location = await tx.locationUnit.findFirst({
      where: { id: locationUnitId, organizationId },
    });
    if (!location) {
      throw new OrderServiceError(
        "LOCATION_UNIT_NOT_FOUND",
        "Location not found",
        404,
      );
    }
    if (location.warehouseId !== allocation.inventoryStock.warehouseId) {
      throw new OrderServiceError(
        "LOCATION_WRONG_WAREHOUSE",
        "Location is not in the allocation warehouse",
      );
    }
    if (allocation.inventoryStock.locationUnit) {
      assertHomeLocation(
        allocation.inventoryStock.locationUnit,
        location.id,
      );
    }

    await tx.orderLineAllocation.update({
      where: { id: allocation.id },
      data: { qtyReturned: { increment: qty } },
    });
    await tx.inventoryStock.update({
      where: { id: allocation.inventoryStockId },
      data: {
        quantityAvailable: { increment: qty },
        locationUnitId: location.id,
      },
    });

    await syncOrderStatusFromLines(tx, organizationId, orderId);
  });

  return getMappedOrder(organizationId, orderId);
}

export async function reportReturnIssue(
  organizationId: string,
  orderId: string,
  createdByUserId: string,
  input: {
    itemId: string;
    type: IssueType;
    quantity: number;
    notes: string | null;
  },
  options?: { requireEligible?: boolean },
) {
  await prisma.$transaction(async (tx) => {
    const order = await tx.eventOrder.findFirst({
      where: { id: orderId, organizationId },
      include: {
        status: true,
        lines: {
          include: {
            item: {
              include: {
                stocks: {
                  orderBy: { createdAt: "asc" },
                },
              },
            },
            allocations: true,
            issues: { select: { quantity: true } },
          },
        },
      },
    });
    if (!order) {
      throw new OrderServiceError("Not Found", "Order not found", 404);
    }
    if (options?.requireEligible !== false && !canReportOrderIssue(order)) {
      throw new OrderServiceError(
        "ORDER_NOT_ELIGIBLE",
        "Order is not eligible for an issue report",
        409,
      );
    }

    const line = order.lines.find((row) => row.itemId === input.itemId);
    if (!line) {
      throw new OrderServiceError(
        "ITEM_NOT_ON_ORDER",
        "That item is not on this order",
      );
    }

    const qtyPicked = line.allocations.reduce(
      (sum, allocation) => sum + allocation.qtyPicked,
      0,
    );
    const qtyReturned = line.allocations.reduce(
      (sum, allocation) => sum + allocation.qtyReturned,
      0,
    );
    const qtyIssued = line.issues.reduce((sum, issue) => sum + issue.quantity, 0);
    const remainingToAccount = qtyPicked - qtyReturned - qtyIssued;
    if (input.quantity > remainingToAccount) {
      throw new OrderServiceError(
        "OVER_ISSUE",
        `Cannot report more than unreturned quantity (${remainingToAccount})`,
      );
    }

    const orgOwned = line.item.stocks.reduce(
      (sum, stock) => sum + stock.quantityOwned,
      0,
    );
    if (input.quantity > orgOwned) {
      throw new OrderServiceError(
        "INSUFFICIENT_OWNED",
        `Only ${orgOwned} owned`,
      );
    }

    await tx.issue.create({
      data: {
        organizationId,
        type: input.type,
        itemId: line.itemId,
        orderLineId: line.id,
        quantity: input.quantity,
        notes: input.notes,
        createdByUserId,
      },
    });

    let remaining = input.quantity;
    for (const stock of line.item.stocks) {
      if (remaining <= 0) {
        break;
      }
      const take = Math.min(stock.quantityOwned, remaining);
      if (take <= 0) {
        continue;
      }
      await tx.inventoryStock.update({
        where: { id: stock.id },
        data: {
          quantityOwned: { decrement: take },
          quantityAvailable: { decrement: Math.min(stock.quantityAvailable, take) },
        },
      });
      remaining -= take;
    }

    const nextOwned = orgOwned - input.quantity;
    if (nextOwned <= 0) {
      await tx.item.update({
        where: { id: line.itemId },
        data: { disposition: input.type },
      });
    }

    await syncOrderStatusFromLines(tx, organizationId, orderId);
  });

  return getMappedOrder(organizationId, orderId);
}
