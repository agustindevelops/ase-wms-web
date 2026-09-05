import "server-only";

import { prisma } from "@/lib/db/prisma";
import { ORDER_STATUS_RETURNED } from "@/lib/db/defaults";

const DASHBOARD_TZ = "America/Chicago";

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "00";

  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    second: Number(get("second")),
  };
}

/** Approximate UTC Date for a wall-clock instant in America/Chicago. */
function chicagoWallToUtc(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
): Date {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second);
  const asIfUtc = new Date(utcGuess);
  const parts = zonedParts(asIfUtc, DASHBOARD_TZ);
  const asChicago = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  const offsetMs = asChicago - utcGuess;
  return new Date(utcGuess - offsetMs);
}

export function chicagoDayBounds(day?: string): { start: Date; end: Date; day: string } {
  const now = new Date();
  const parts = zonedParts(now, DASHBOARD_TZ);
  let year = parts.year;
  let month = parts.month;
  let dayNum = parts.day;

  if (day) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
    if (!match) {
      throw new DashboardServiceError(
        "Bad Request",
        "day must be YYYY-MM-DD",
        400,
      );
    }
    year = Number(match[1]);
    month = Number(match[2]);
    dayNum = Number(match[3]);
  }

  const start = chicagoWallToUtc(year, month, dayNum, 0, 0, 0);
  const end = chicagoWallToUtc(year, month, dayNum + 1, 0, 0, 0);
  const dayKey = `${year}-${String(month).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
  return { start, end, day: dayKey };
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function last24HoursBounds(now = new Date()): { start: Date; end: Date } {
  return {
    start: new Date(now.getTime() - MS_PER_DAY),
    end: now,
  };
}

export function chicagoMonthBounds(now = new Date()): { start: Date; end: Date } {
  const parts = zonedParts(now, DASHBOARD_TZ);
  const start = chicagoWallToUtc(parts.year, parts.month, 1, 0, 0, 0);
  const end =
    parts.month === 12
      ? chicagoWallToUtc(parts.year + 1, 1, 1, 0, 0, 0)
      : chicagoWallToUtc(parts.year, parts.month + 1, 1, 0, 0, 0);
  return { start, end };
}

export class DashboardServiceError extends Error {
  status: number;
  code: string;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "DashboardServiceError";
    this.code = code;
    this.status = status;
  }
}

export type DashboardSummary = {
  totalInventory: number;
  upcomingEventsThisMonth: number;
  issuesThisMonth: number;
  changesLast24Hours: number;
};

export async function getDashboardSummary(
  organizationId: string,
): Promise<DashboardSummary> {
  const { start: monthStart, end: monthEnd } = chicagoMonthBounds();
  const { start: recentStart, end: recentEnd } = last24HoursBounds();

  const returnedStatus = await prisma.orderStatus.findUnique({
    where: { code: ORDER_STATUS_RETURNED },
    select: { id: true },
  });

  const [ownedAgg, upcomingEventsThisMonth, issuesThisMonth, changesLast24Hours] =
    await Promise.all([
      prisma.inventoryStock.aggregate({
        where: { organizationId },
        _sum: { quantityOwned: true },
      }),
      prisma.eventOrder.count({
        where: {
          organizationId,
          eventDate: { gte: monthStart, lt: monthEnd },
          ...(returnedStatus
            ? { statusId: { not: returnedStatus.id } }
            : {}),
        },
      }),
      prisma.issue.count({
        where: {
          organizationId,
          createdAt: { gte: monthStart, lt: monthEnd },
        },
      }),
      prisma.userActivity.count({
        where: {
          organizationId,
          createdAt: { gte: recentStart, lt: recentEnd },
        },
      }),
    ]);

  return {
    totalInventory: ownedAgg._sum.quantityOwned ?? 0,
    upcomingEventsThisMonth,
    issuesThisMonth,
    changesLast24Hours,
  };
}

export type ActivityFeedItem = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  createdAt: Date;
  actor: {
    id: string;
    email: string;
    initial: string;
  };
};

export type ActivityFeedResult = {
  day: string;
  activities: ActivityFeedItem[];
};

export async function listDashboardActivity(
  organizationId: string,
  options: { day?: string; limit?: number } = {},
): Promise<ActivityFeedResult> {
  const { start, end, day } = options.day
    ? chicagoDayBounds(options.day)
    : { ...last24HoursBounds(), day: chicagoDayBounds().day };
  const limit = Math.min(Math.max(options.limit ?? 3, 1), 100);

  const rows = await prisma.userActivity.findMany({
    where: {
      organizationId,
      createdAt: { gte: start, lt: end },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      actor: { select: { id: true, email: true } },
    },
  });

  return {
    day,
    activities: rows.map((row) => ({
      id: row.id,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      summary: row.summary,
      createdAt: row.createdAt,
      actor: {
        id: row.actor.id,
        email: row.actor.email,
        initial: (row.actor.email[0] ?? "?").toUpperCase(),
      },
    })),
  };
}
