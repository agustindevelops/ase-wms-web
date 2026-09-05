/**
 * Ordered fulfillment lifecycle. Index is the progress rank.
 *
 *   os_paid (0) → os_picked_up (1) → os_returned (2)
 *
 * Completion / lock checks use these indexes:
 *
 *   ORDER_STATUS.findIndex(target) > orderStatusIndex(current)
 *   → current has not reached target yet (`isBeforeOrderStatus`)
 *
 * Pickup success: os_picked_up
 * Return success: os_returned
 */

export const ORDER_STATUS_ID = {
  PAID: "os_paid",
  PICKED_UP: "os_picked_up",
  RETURNED: "os_returned",
} as const;

export const ORDER_STATUS = [
  ORDER_STATUS_ID.PAID,
  ORDER_STATUS_ID.PICKED_UP,
  ORDER_STATUS_ID.RETURNED,
] as const;

export type OrderStatusId = (typeof ORDER_STATUS)[number];

export const ORDER_STATUS_CODE = {
  PAID: "PAID",
  PICKED_UP: "PICKED_UP",
  RETURNED: "RETURNED",
} as const;

const CODE_TO_ID: Record<string, OrderStatusId> = {
  [ORDER_STATUS_CODE.PAID]: ORDER_STATUS_ID.PAID,
  [ORDER_STATUS_CODE.PICKED_UP]: ORDER_STATUS_ID.PICKED_UP,
  [ORDER_STATUS_CODE.RETURNED]: ORDER_STATUS_ID.RETURNED,
};

export function resolveOrderStatusId(statusIdOrCode: string): OrderStatusId | null {
  if ((ORDER_STATUS as readonly string[]).includes(statusIdOrCode)) {
    return statusIdOrCode as OrderStatusId;
  }
  return CODE_TO_ID[statusIdOrCode] ?? null;
}

export function orderStatusIndex(statusIdOrCode: string): number {
  const id = resolveOrderStatusId(statusIdOrCode);
  return id ? ORDER_STATUS.indexOf(id) : -1;
}

/** True when current is still before `target` on the lifecycle. */
export function isBeforeOrderStatus(
  currentStatusIdOrCode: string,
  targetStatusId: OrderStatusId,
): boolean {
  return orderStatusIndex(targetStatusId) > orderStatusIndex(currentStatusIdOrCode);
}

/** True when current has reached or passed `target`. */
export function hasReachedOrderStatus(
  currentStatusIdOrCode: string,
  targetStatusId: OrderStatusId,
): boolean {
  const current = orderStatusIndex(currentStatusIdOrCode);
  const target = orderStatusIndex(targetStatusId);
  return current >= 0 && target >= 0 && current >= target;
}

export function orderStatusRef(order: {
  statusId?: string;
  status?: { id?: string; code?: string };
}): string {
  return order.statusId || order.status?.id || order.status?.code || "";
}

/** Pickup list: green / read-only once picked up (or returned). */
export function isPickupComplete(order: {
  statusId?: string;
  status?: { id?: string; code?: string };
}): boolean {
  return hasReachedOrderStatus(orderStatusRef(order), ORDER_STATUS_ID.PICKED_UP);
}

/** Return list: green once fully returned. */
export function isReturnComplete(order: {
  statusId?: string;
  status?: { id?: string; code?: string };
}): boolean {
  return hasReachedOrderStatus(orderStatusRef(order), ORDER_STATUS_ID.RETURNED);
}

export function canOpenPickup(_order: {
  statusId?: string;
  status?: { id?: string; code?: string };
}): boolean {
  return true;
}

/** Return rows stay visible when paid, but cannot open until picked up. */
export function canOpenReturn(order: {
  statusId?: string;
  status?: { id?: string; code?: string };
}): boolean {
  return hasReachedOrderStatus(orderStatusRef(order), ORDER_STATUS_ID.PICKED_UP);
}

export function canMutatePickup(order: {
  statusId?: string;
  status?: { id?: string; code?: string };
}): boolean {
  return !isBeforeOrderStatus(orderStatusRef(order), ORDER_STATUS_ID.PAID)
    && isBeforeOrderStatus(orderStatusRef(order), ORDER_STATUS_ID.PICKED_UP);
}

export function canMutateReturn(order: {
  statusId?: string;
  status?: { id?: string; code?: string };
}): boolean {
  return (
    hasReachedOrderStatus(orderStatusRef(order), ORDER_STATUS_ID.PICKED_UP) &&
    isBeforeOrderStatus(orderStatusRef(order), ORDER_STATUS_ID.RETURNED)
  );
}

export function canReportOrderIssue(order: {
  statusId?: string;
  status?: { id?: string; code?: string };
}): boolean {
  return hasReachedOrderStatus(orderStatusRef(order), ORDER_STATUS_ID.PICKED_UP);
}
