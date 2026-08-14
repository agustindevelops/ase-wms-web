import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { ORDER_STATUS_PAID, ORDER_STATUSES } from "@/lib/db/defaults";
import { prisma } from "@/lib/db/prisma";
import { OrderServiceError } from "@/lib/order/errors";
import { syncOrderStatusFromLines } from "@/lib/order/fulfillmentService";

const orderListInclude = {
  status: { select: { id: true, code: true, name: true } },
  _count: { select: { lines: true } },
} satisfies Prisma.EventOrderInclude;

const orderDetailInclude = {
  status: { select: { id: true, code: true, name: true } },
  createdBy: { select: { id: true, email: true } },
  lines: {
    include: {
      item: {
        select: {
          id: true,
          name: true,
          warehouseId: true,
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

export type OrderDetailRecord = Prisma.EventOrderGetPayload<{
  include: typeof orderDetailInclude;
}>;

export type OrderCreateInput = {
  name: string;
  eventDate: Date | null;
};

export type OrderUpdateInput = {
  name?: string;
  eventDate?: Date | null;
  statusId?: string;
};

export type OrderLineCreateInput = {
  itemId: string;
  qtyRequested: number;
};

export type OrderLineUpdateInput = {
  qtyRequested?: number;
  qtyPicked?: number;
  qtyReturned?: number;
};

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

function asOptionalEventDate(value: unknown): Date | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value !== "string") {
    throw new OrderServiceError("Bad Request", "eventDate must be a date string");
  }
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new OrderServiceError(
      "Bad Request",
      "eventDate must be YYYY-MM-DD",
    );
  }
  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new OrderServiceError("Bad Request", "eventDate is invalid");
  }
  return parsed;
}

function asQtyRequested(value: unknown): number {
  const qty = asNonNegativeInt(value, "qtyRequested");
  if (qty <= 0) {
    throw new OrderServiceError(
      "Bad Request",
      "qtyRequested must be an integer greater than 0",
    );
  }
  return qty;
}

function asNonNegativeInt(value: unknown, field: string): number {
  const qty =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;
  if (!Number.isInteger(qty) || qty < 0) {
    throw new OrderServiceError(
      "Bad Request",
      `${field} must be an integer of 0 or more`,
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
  if (
    input.name === undefined &&
    input.eventDate === undefined &&
    input.statusId === undefined
  ) {
    throw new OrderServiceError(
      "Bad Request",
      "Provide name, eventDate, or statusId",
    );
  }
  return input;
}

export function parseOrderLineCreateInput(
  body: Record<string, unknown>,
): OrderLineCreateInput {
  return {
    itemId: asRequiredString(body.itemId, "itemId"),
    qtyRequested: asQtyRequested(body.qtyRequested),
  };
}

export function parseOrderLineUpdate(
  body: Record<string, unknown>,
): OrderLineUpdateInput {
  const input: OrderLineUpdateInput = {};
  if (body.qtyRequested !== undefined) {
    input.qtyRequested = asQtyRequested(body.qtyRequested);
  }
  if (body.qtyPicked !== undefined) {
    input.qtyPicked = asNonNegativeInt(body.qtyPicked, "qtyPicked");
  }
  if (body.qtyReturned !== undefined) {
    input.qtyReturned = asNonNegativeInt(body.qtyReturned, "qtyReturned");
  }
  if (
    input.qtyRequested === undefined &&
    input.qtyPicked === undefined &&
    input.qtyReturned === undefined
  ) {
    throw new OrderServiceError(
      "Bad Request",
      "Provide qtyRequested, qtyPicked, or qtyReturned",
    );
  }
  return input;
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
  statusCodes?: string[],
): Promise<OrderListRecord[]> {
  return prisma.eventOrder.findMany({
    where: statusCodes?.length
      ? { status: { code: { in: statusCodes } } }
      : undefined,
    include: orderListInclude,
    orderBy: [{ eventDate: "asc" }, { createdAt: "desc" }],
  });
}

export async function getOrder(orderId: string): Promise<OrderDetailRecord> {
  const order = await prisma.eventOrder.findUnique({
    where: { id: orderId },
    include: orderDetailInclude,
  });
  if (!order) {
    throw new OrderServiceError("Not Found", "Order not found", 404);
  }
  return order;
}

export async function createOrder(
  input: OrderCreateInput,
  createdByUserId: string,
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

  return prisma.eventOrder.create({
    data: {
      name: input.name,
      eventDate: input.eventDate,
      statusId: status.id,
      createdByUserId,
    },
    include: orderDetailInclude,
  });
}

export async function updateOrder(
  orderId: string,
  input: OrderUpdateInput,
): Promise<OrderDetailRecord> {
  await getOrder(orderId);

  if (input.statusId) {
    const status = await prisma.orderStatus.findUnique({
      where: { id: input.statusId },
    });
    if (!status) {
      throw new OrderServiceError("Bad Request", "Unknown statusId");
    }
  }

  return prisma.eventOrder.update({
    where: { id: orderId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.eventDate !== undefined ? { eventDate: input.eventDate } : {}),
      ...(input.statusId !== undefined ? { statusId: input.statusId } : {}),
    },
    include: orderDetailInclude,
  });
}

export async function addOrUpdateOrderLine(
  orderId: string,
  input: OrderLineCreateInput,
): Promise<OrderDetailRecord> {
  await getOrder(orderId);

  const item = await prisma.item.findUnique({
    where: { id: input.itemId },
    select: { id: true },
  });
  if (!item) {
    throw new OrderServiceError("Bad Request", "Item not found");
  }

  const existing = await prisma.orderLine.findUnique({
    where: {
      orderId_itemId: { orderId, itemId: input.itemId },
    },
  });

  if (existing) {
    await prisma.$transaction(async (tx) => {
      await tx.orderLine.update({
        where: { id: existing.id },
        data: { qtyRequested: input.qtyRequested },
      });
      await syncOrderStatusFromLines(tx, orderId);
    });
    return getOrder(orderId);
  }

  await prisma.$transaction(async (tx) => {
    await tx.orderLine.create({
      data: {
        orderId,
        itemId: input.itemId,
        qtyRequested: input.qtyRequested,
      },
    });
    await syncOrderStatusFromLines(tx, orderId);
  });

  return getOrder(orderId);
}

export async function updateOrderLine(
  orderId: string,
  lineId: string,
  input: OrderLineUpdateInput,
): Promise<OrderDetailRecord> {
  await prisma.$transaction(async (tx) => {
    const line = await tx.orderLine.findFirst({
      where: { id: lineId, orderId },
      include: { item: true },
    });
    if (!line) {
      throw new OrderServiceError("Not Found", "Order line not found", 404);
    }

    const nextRequested = input.qtyRequested ?? line.qtyRequested;
    const nextPicked = input.qtyPicked ?? line.qtyPicked;
    const nextReturned = input.qtyReturned ?? line.qtyReturned;

    const pickedDelta = nextPicked - line.qtyPicked;
    const returnedDelta = nextReturned - line.qtyReturned;
    const availableDelta = -pickedDelta + returnedDelta;

    await tx.orderLine.update({
      where: { id: lineId },
      data: {
        qtyRequested: nextRequested,
        qtyPicked: nextPicked,
        qtyReturned: nextReturned,
      },
    });
    if (availableDelta > 0) {
      await tx.item.update({
        where: { id: line.itemId },
        data: { quantityAvailable: { increment: availableDelta } },
      });
    } else if (availableDelta < 0 && line.item.quantityAvailable > 0) {
      await tx.item.update({
        where: { id: line.itemId },
        data: {
          quantityAvailable: {
            decrement: Math.min(line.item.quantityAvailable, -availableDelta),
          },
        },
      });
    }
    await syncOrderStatusFromLines(tx, orderId);
  });

  return getOrder(orderId);
}

export async function deleteOrderLine(
  orderId: string,
  lineId: string,
): Promise<OrderDetailRecord> {
  await prisma.$transaction(async (tx) => {
    const line = await tx.orderLine.findFirst({
      where: { id: lineId, orderId },
      include: { issues: { select: { quantity: true } } },
    });
    if (!line) {
      throw new OrderServiceError("Not Found", "Order line not found", 404);
    }

    const qtyIssued = line.issues.reduce((sum, issue) => sum + issue.quantity, 0);
    const restoreAvailable = Math.max(
      0,
      line.qtyPicked - line.qtyReturned - qtyIssued,
    );
    if (restoreAvailable > 0) {
      await tx.item.update({
        where: { id: line.itemId },
        data: { quantityAvailable: { increment: restoreAvailable } },
      });
    }

    await tx.orderLine.delete({ where: { id: lineId } });
    await syncOrderStatusFromLines(tx, orderId);
  });

  return getOrder(orderId);
}
