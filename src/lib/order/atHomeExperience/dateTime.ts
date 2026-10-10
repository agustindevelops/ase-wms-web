import { BOOKING_LEAD_DAYS, AT_HOME_EXPERIENCE_TIME_ZONE } from "./constants";

/** "YYYY-MM-DD" that names a real calendar day. */
export function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

/** 24-hour "HH:mm". */
export function isValidTimeString(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
}

/** Today's date at the event location as YYYY-MM-DD. */
export function todayAtEventLocation(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: AT_HOME_EXPERIENCE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** First day a guest may book (YYYY-MM-DD): today at the event location plus the lead time. */
export function earliestBookableDate(now: Date = new Date()): string {
  return addDays(todayAtEventLocation(now), BOOKING_LEAD_DAYS);
}

function timeZoneOffsetMs(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((entry) => entry.type === type)?.value);
  const wall = Date.UTC(
    part("year"),
    part("month") - 1,
    part("day"),
    part("hour"),
    part("minute"),
    part("second"),
  );
  return wall - Math.floor(instant / 1000) * 1000;
}

/** Wall-clock date + time at the event location → absolute instant. */
export function zonedDateTime(date: string, time: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  const wall = Date.UTC(year, month - 1, day, hours, minutes);
  const firstGuess = wall - timeZoneOffsetMs(wall, AT_HOME_EXPERIENCE_TIME_ZONE);
  return new Date(
    wall - timeZoneOffsetMs(firstGuess, AT_HOME_EXPERIENCE_TIME_ZONE),
  );
}
