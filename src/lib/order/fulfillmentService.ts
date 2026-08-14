import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import {
  ISSUE_TYPES,
  ORDER_STATUS_PAID,
  ORDER_STATUS_PICKED_UP,
  ORDER_STATUS_RETURNED,
  PICKUP_ORDER_STATUS_CODES,
  QR_CODE_TYPE_ITEM,
  QR_CODE_TYPE_LOCATION,
  RETURN_ORDER_STATUS_CODES,
  type IssueType,
} from "@/lib/db/defaults";
import { prisma } from "@/lib/db/prisma";
import { OrderServiceError } from "@/lib/order/errors";

const pickupStatusCodes: string[] = [...PICKUP_ORDER_STATUS_CODES];
const pickupViewStatusCodes: string[] = [
  ...pickupStatusCodes,
  ORDER_STATUS_PICKED_UP,
];
const returnStatusCodes: string[] = [...RETURN_ORDER_STATUS_CODES];
const returnViewStatusCodes: string[] = [
  ...returnStatusCodes,
  ORDER_STATUS_RETURNED,
];

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
      warehouseId: true,
      quantityOwned: true,
      quantityAvailable: true,
      locationUnit: { select: locationUnitPathSelect },
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
} {
  return {
    itemId: asRequiredString(body.itemId, "itemId"),
    qty: asPositiveQty(body.qty, "qty"),
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
  const qtyIssued = line.issues.reduce((sum, issue) => sum + issue.quantity, 0);
  const qtyRemaining = Math.max(0, line.qtyRequested - line.qtyPicked);
  const qtyOutstanding = Math.max(
    0,
    line.qtyPicked - line.qtyReturned - qtyIssued,
  );
  return {
    id: line.id,
    itemId: line.itemId,
    qtyRequested: line.qtyRequested,
    qtyPicked: line.qtyPicked,
    qtyReturned: line.qtyReturned,
    qtyRemaining,
    qtyOutstanding,
    qtyIssued,
    item: {
      id: line.item.id,
      name: line.item.name,
      warehouseId: line.item.warehouseId,
      quantityOwned: line.item.quantityOwned,
      quantityAvailable: line.item.quantityAvailable,
      locationLabel: locationLabel(line.item.locationUnit),
      locationUnit: line.item.locationUnit
        ? {
            id: line.item.locationUnit.id,
            name: line.item.locationUnit.name,
            label: line.item.locationUnit.label,
            warehouseId: line.item.locationUnit.warehouseId,
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
  orderId: string,
): Promise<FulfillmentOrderRecord> {
  const order = await prisma.eventOrder.findUnique({
    where: { id: orderId },
    include: fulfillmentOrderInclude,
  });
  if (!order) {
    throw new OrderServiceError("Not Found", "Order not found", 404);
  }
  return order;
}

function assertPickupEligible(order: FulfillmentOrderRecord) {
  if (!pickupStatusCodes.includes(order.status.code)) {
    throw new OrderServiceError(
      "ORDER_NOT_ELIGIBLE",
      "Order is not eligible for pickup",
      409,
    );
  }
}

function assertPickupViewable(order: FulfillmentOrderRecord) {
  if (!pickupViewStatusCodes.includes(order.status.code)) {
    throw new OrderServiceError(
      "ORDER_NOT_ELIGIBLE",
      "Order is not eligible for pickup",
      409,
    );
  }
}

function assertReturnEligible(order: FulfillmentOrderRecord) {
  if (!returnStatusCodes.includes(order.status.code)) {
    throw new OrderServiceError(
      "ORDER_NOT_ELIGIBLE",
      "Order is not eligible for return",
      409,
    );
  }
}

function assertReturnViewable(order: FulfillmentOrderRecord) {
  if (!returnViewStatusCodes.includes(order.status.code)) {
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
  orderId: string,
) {
  const lines = await tx.orderLine.findMany({
    where: { orderId },
    select: {
      qtyRequested: true,
      qtyPicked: true,
      qtyReturned: true,
      issues: { select: { quantity: true } },
    },
  });
  if (lines.length === 0) {
    await setOrderStatusByCode(tx, orderId, ORDER_STATUS_PAID);
    return;
  }

  const allPicked = lines.every((row) => row.qtyPicked >= row.qtyRequested);
  const allReturned = lines.every((row) => {
    const qtyIssued = row.issues.reduce((sum, issue) => sum + issue.quantity, 0);
    return row.qtyReturned + qtyIssued >= row.qtyPicked;
  });
  const hasPickedQty = lines.some((row) => row.qtyPicked > 0);

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

export async function listPickupOrders() {
  const orders = await prisma.eventOrder.findMany({
    where: { status: { code: { in: pickupStatusCodes } } },
    include: fulfillmentOrderInclude,
    orderBy: [{ eventDate: "asc" }, { createdAt: "desc" }],
  });
  return orders.map(mapOrder);
}

export async function getPickupOrder(orderId: string) {
  const order = await loadFulfillmentOrder(orderId);
  assertPickupViewable(order);
  return mapOrder(order);
}

export async function listReturnOrders() {
  const orders = await prisma.eventOrder.findMany({
    where: { status: { code: { in: returnStatusCodes } } },
    include: fulfillmentOrderInclude,
    orderBy: [{ eventDate: "asc" }, { createdAt: "desc" }],
  });
  return orders.map(mapOrder);
}

export async function getReturnOrder(orderId: string) {
  const order = await loadFulfillmentOrder(orderId);
  assertReturnViewable(order);
  return mapOrder(order);
}

async function findQr(idOrPayload: string) {
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
      ? await loadFulfillmentOrder(orderId).then((row) => {
          assertPickupEligible(row);
          return row;
        })
      : await loadFulfillmentOrder(orderId).then((row) => {
          assertReturnEligible(row);
          return row;
        });

  const qrCode = await findQr(trimmed);
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
      if (line.item.locationUnit) {
        assertHomeLocation(line.item.locationUnit, qrCode.locationUnit.id);
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

async function getMappedOrder(orderId: string) {
  return mapOrder(await loadFulfillmentOrder(orderId));
}

export async function pickOrderLine(
  orderId: string,
  itemId: string,
  qty: number,
) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.eventOrder.findUnique({
      where: { id: orderId },
      include: {
        status: true,
        lines: { include: { item: true } },
      },
    });
    if (!order) {
      throw new OrderServiceError("Not Found", "Order not found", 404);
    }
    if (!pickupStatusCodes.includes(order.status.code)) {
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

    const remaining = line.qtyRequested - line.qtyPicked;
    if (qty > remaining) {
      throw new OrderServiceError(
        "OVER_PICK",
        `Cannot pick more than remaining (${remaining})`,
      );
    }
    if (qty > line.item.quantityAvailable) {
      throw new OrderServiceError(
        "INSUFFICIENT_AVAILABLE",
        `Only ${line.item.quantityAvailable} available`,
      );
    }

    await tx.orderLine.update({
      where: { id: line.id },
      data: { qtyPicked: { increment: qty } },
    });
    await tx.item.update({
      where: { id: line.itemId },
      data: { quantityAvailable: { decrement: qty } },
    });

    await syncOrderStatusFromLines(tx, orderId);
  }).then(() => getMappedOrder(orderId));
}

export async function returnOrderLine(
  orderId: string,
  itemId: string,
  qty: number,
  locationUnitId: string,
) {
  await prisma.$transaction(async (tx) => {
    const order = await tx.eventOrder.findUnique({
      where: { id: orderId },
      include: {
        status: true,
        lines: {
          include: {
            item: {
              include: { locationUnit: { select: locationUnitPathSelect } },
            },
          },
        },
      },
    });
    if (!order) {
      throw new OrderServiceError("Not Found", "Order not found", 404);
    }
    if (!returnStatusCodes.includes(order.status.code)) {
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

    const outstanding = line.qtyPicked - line.qtyReturned;
    const issued = await tx.issue.aggregate({
      where: { orderLineId: line.id },
      _sum: { quantity: true },
    });
    const qtyIssued = issued._sum.quantity ?? 0;
    const remainingToReturn = outstanding - qtyIssued;
    if (qty > remainingToReturn) {
      throw new OrderServiceError(
        "OVER_RETURN",
        `Cannot return more than outstanding (${remainingToReturn})`,
      );
    }

    const location = await tx.locationUnit.findUnique({
      where: { id: locationUnitId },
    });
    if (!location) {
      throw new OrderServiceError(
        "LOCATION_UNIT_NOT_FOUND",
        "Location not found",
        404,
      );
    }
    if (location.warehouseId !== line.item.warehouseId) {
      throw new OrderServiceError(
        "LOCATION_WRONG_WAREHOUSE",
        "Location is not in the item's warehouse",
      );
    }
    if (line.item.locationUnit) {
      assertHomeLocation(line.item.locationUnit, location.id);
    }

    await tx.orderLine.update({
      where: { id: line.id },
      data: { qtyReturned: { increment: qty } },
    });
    await tx.item.update({
      where: { id: line.itemId },
      data: {
        quantityAvailable: { increment: qty },
        locationUnitId: location.id,
      },
    });

    await syncOrderStatusFromLines(tx, orderId);
  });

  return getMappedOrder(orderId);
}

export async function reportReturnIssue(
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
    const order = await tx.eventOrder.findUnique({
      where: { id: orderId },
      include: {
        status: true,
        lines: {
          include: {
            item: true,
            issues: { select: { quantity: true } },
          },
        },
      },
    });
    if (!order) {
      throw new OrderServiceError("Not Found", "Order not found", 404);
    }
    if (options?.requireEligible !== false) {
      if (!returnStatusCodes.includes(order.status.code)) {
        throw new OrderServiceError(
          "ORDER_NOT_ELIGIBLE",
          "Order is not eligible for return",
          409,
        );
      }
    }

    const line = order.lines.find((row) => row.itemId === input.itemId);
    if (!line) {
      throw new OrderServiceError(
        "ITEM_NOT_ON_ORDER",
        "That item is not on this order",
      );
    }

    const qtyIssued = line.issues.reduce((sum, issue) => sum + issue.quantity, 0);
    const remainingToAccount =
      line.qtyPicked - line.qtyReturned - qtyIssued;
    if (input.quantity > remainingToAccount) {
      throw new OrderServiceError(
        "OVER_ISSUE",
        `Cannot report more than unreturned quantity (${remainingToAccount})`,
      );
    }
    if (input.quantity > line.item.quantityOwned) {
      throw new OrderServiceError(
        "INSUFFICIENT_OWNED",
        `Only ${line.item.quantityOwned} owned`,
      );
    }

    await tx.issue.create({
      data: {
        type: input.type,
        itemId: line.itemId,
        orderLineId: line.id,
        quantity: input.quantity,
        notes: input.notes,
        createdByUserId,
      },
    });
    await tx.item.update({
      where: { id: line.itemId },
      data: { quantityOwned: { decrement: input.quantity } },
    });

    await syncOrderStatusFromLines(tx, orderId);
  });

  return getMappedOrder(orderId);
}
