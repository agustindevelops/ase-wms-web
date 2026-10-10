export const AT_HOME_EXPERIENCE_PRICING = {
  ourFurnitureBaseCents: 65_000,
  clientFurnitureBaseCents: 45_000,

  baseGuestCount: 6,
  maxGuestCount: 10,
  additionalGuestCents: 2_500,

  specialAccessCents: 5_000,
  lateNightPickupCents: 10_000,
  outsideServiceAreaCents: 1_500,
} as const;

export const AT_HOME_EXPERIENCE_TIME_ZONE = "America/Chicago";

/** Guests book at least this many days ahead: a Friday booking can be for Monday. */
export const BOOKING_LEAD_DAYS = 3;

export const PICKUP_RULES = {
  sameDayPickupCutoffHour: 21,
  lateEventHour: 22,
  setupHours: 2,
  sameDayPickupMinutes: 60,
  morningPickupMinutes: 30,
} as const;

export const NEXT_MORNING_PICKUP_TIMES = [
  "08:00",
  "08:30",
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
] as const;

export type AccessType = "STANDARD" | "SPECIAL";

export type PickupOption = "SAME_DAY" | "NEXT_MORNING" | "LATE_NIGHT";

export const PICKUP_OPTIONS: readonly PickupOption[] = [
  "SAME_DAY",
  "NEXT_MORNING",
  "LATE_NIGHT",
];
