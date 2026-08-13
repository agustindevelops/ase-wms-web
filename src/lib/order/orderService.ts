import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { ORDER_STATUSES } from "@/lib/db/defaults";
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
