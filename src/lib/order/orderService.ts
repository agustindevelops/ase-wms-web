import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { ORDER_STATUS_PAYMENT_PENDING, ORDER_STATUSES } from "@/lib/db/defaults";
import { prisma } from "@/lib/db/prisma";
import { OrderServiceError } from "@/lib/order/errors";

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
  const qty =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;
  if (!Number.isInteger(qty) || qty <= 0) {
    throw new OrderServiceError(
      "Bad Request",
      "qtyRequested must be an integer greater than 0",
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

export function parseOrderLineQtyUpdate(
  body: Record<string, unknown>,
): number {
  return asQtyRequested(body.qtyRequested);
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
    where: { code: ORDER_STATUS_PAYMENT_PENDING },
  });
  if (!status) {
    throw new OrderServiceError(
      "ORDER_STATUS_MISSING",
      "PAYMENT_PENDING status is not seeded",
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
    if (input.qtyRequested < existing.qtyPicked) {
      throw new OrderServiceError(
        "Bad Request",
        `qtyRequested cannot be below qtyPicked (${existing.qtyPicked})`,
      );
    }
    await prisma.orderLine.update({
      where: { id: existing.id },
      data: { qtyRequested: input.qtyRequested },
    });
    return getOrder(orderId);
  }

  await prisma.orderLine.create({
    data: {
      orderId,
      itemId: input.itemId,
      qtyRequested: input.qtyRequested,
    },
  });

  return getOrder(orderId);
}

export async function updateOrderLineQty(
  orderId: string,
  lineId: string,
  qtyRequested: number,
): Promise<OrderDetailRecord> {
  const line = await prisma.orderLine.findFirst({
    where: { id: lineId, orderId },
  });
  if (!line) {
    throw new OrderServiceError("Not Found", "Order line not found", 404);
  }
  if (qtyRequested < line.qtyPicked) {
    throw new OrderServiceError(
      "Bad Request",
      `qtyRequested cannot be below qtyPicked (${line.qtyPicked})`,
    );
  }

  await prisma.orderLine.update({
    where: { id: lineId },
    data: { qtyRequested },
  });

  return getOrder(orderId);
}

export async function deleteOrderLine(
  orderId: string,
  lineId: string,
): Promise<OrderDetailRecord> {
  const line = await prisma.orderLine.findFirst({
    where: { id: lineId, orderId },
  });
  if (!line) {
    throw new OrderServiceError("Not Found", "Order line not found", 404);
  }
  if (line.qtyPicked > 0) {
    throw new OrderServiceError(
      "Bad Request",
      "Cannot remove a line that already has picked quantity",
    );
  }

  await prisma.orderLine.delete({ where: { id: lineId } });
  return getOrder(orderId);
}
