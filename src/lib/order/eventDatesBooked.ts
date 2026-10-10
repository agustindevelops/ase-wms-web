import "server-only";

import { ORDER_STATUS_PAYMENT_PENDING } from "@/lib/db/defaults";
import { prisma } from "@/lib/db/prisma";
import {
  earliestBookableDate,
  todayAtEventLocation,
} from "@/lib/order/atHomeExperience";
import { OrderServiceError } from "@/lib/order/errors";

const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** Unpaid checkouts do not hold a day; every later status does. */
const holdsEventDate = { status: { code: { not: ORDER_STATUS_PAYMENT_PENDING } } };

/** `?month=YYYY-MM`; missing means the current month at the event location. */
export function parseBookingMonth(value: string | null): string {
  if (value === null || value.trim() === "") {
    return todayAtEventLocation().slice(0, 7);
  }
  const month = value.trim();
  if (!MONTH_PATTERN.test(month)) {
    throw new OrderServiceError("Bad Request", "month must be YYYY-MM");
  }
  return month;
}

function monthRange(month: string): { gte: Date; lt: Date } {
  const [year, monthNumber] = month.split("-").map(Number);
  return {
    gte: new Date(Date.UTC(year, monthNumber - 1, 1)),
    lt: new Date(Date.UTC(year, monthNumber, 1)),
  };
}

export type EventDatesBooked = {
  earliestBookableDate: string;
  bookedDates: string[];
};

/** Days in `month` (YYYY-MM) that already have an event for the organization. */
export async function getEventDatesBooked(
  organizationId: string,
  month: string,
): Promise<EventDatesBooked> {
  const orders = await prisma.eventOrder.findMany({
    where: { organizationId, eventDate: monthRange(month), ...holdsEventDate },
    select: { eventDate: true },
    distinct: ["eventDate"],
    orderBy: { eventDate: "asc" },
  });
  return {
    earliestBookableDate: earliestBookableDate(),
    bookedDates: orders.flatMap((order) =>
      order.eventDate ? [order.eventDate.toISOString().slice(0, 10)] : [],
    ),
  };
}

/** One event per day for the organization. */
export async function assertEventDateOpen(
  organizationId: string,
  eventDate: Date,
): Promise<void> {
  const booked = await prisma.eventOrder.findFirst({
    where: { organizationId, eventDate, ...holdsEventDate },
    select: { id: true },
  });
  if (booked) {
    throw new OrderServiceError(
      "EVENT_DATE_BOOKED",
      "That date is already booked. Please choose another date.",
      409,
    );
  }
}
